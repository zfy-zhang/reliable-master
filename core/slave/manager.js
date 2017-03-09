'use strict';

const zmq = require('zmq');
const EOL = require('os').EOL;
const co = require('co');

const cluster = require('cluster');
const events = require('reliable-events');

const _ = require('../../common/utils/helper');
const logger = require('../../common/utils/logger');
const models = require('../../common/models');

const Device = models.Device;
const Slave = models.Slave;

const STATUS = {
    AVAILABLE: 'available',
    BUSY: 'busy',
    ACK: 'ack'
};

class Manager {
    constructor() {
        this.slaves = {};
        this.init();
    }

    init() {
        this.monitor();
        _.setArchiveConfig('slaves', this.slaves);
    }
    /**
      在slave连接上的时候去注册并保存slave到数据库
    */
    saveSlave(){
      co(function*() {
        try {
          //body...
          var redisSlaves = yield _.getArchiveConfig('slaves');

          if (Object.keys(redisSlaves || {}).length != 0) {

              var result = [];

              redisSlaves = _.values(redisSlaves);

              for (var i = 0; i < redisSlaves.length; i++) {

                  var redisSlave = redisSlaves[i];

                  var ip = redisSlave.ip;
                  var webPort = redisSlave.webPort;

                  var slaveUrl = `http://${ip}:${webPort}`;

                  //查询数据库中是否已经保存过该slave
                  var slave = new Slave();
                  const dbSlave = yield slave.getByUrl(slaveUrl);

                  var slaveId;
                  //如果没有保存过，则将slave保存到数据库
                  if (dbSlave == null) {

                      slave.slaveUrl = slaveUrl;
                      slave.slaveIp = ip;
                      slave.slavePort = webPort;
                      yield slave.add();
                  } else {
                      dbSlave.status = 1;
                      dbSlave.updateById(slaveId, dbSlave);
                  }
                }
              }else {
                
              }
        } catch (err) {
          console.log(err);
        }

        });
    }

    bind(data) {
        const hostname = data.sysInfo.hostname;

        const sock = zmq.socket('pair');
        const address = `tcp://${data.ip}:${data.port}`;

        logger.debug(`connect to tcp://${data.ip}:${data.port}`);

        sock.connect(address);
        sock.on('message', (e) => {
            const data = JSON.parse(e.toString());
            const _hostname = data.sysInfo.hostname;
            // data
            //
            // {
            //    type: 'ack', 'task', 'monitor'
            //    sysInfo
            //    timestamp
            // }

            switch (data.type) {
                case 'ack':
                    this.slaves[hostname || _hostname].status = STATUS.AVAILABLE;
                    events.sendToSingleCluster({
                        message: events.EVENTS.SLAVE_ONLINE,
                        data: this.getAvailableSlaves()
                    });
                    break;
                case 'task':
                    const id = parseInt(Math.random() * Object.keys(cluster.workers).length + 1, 10);
                    cluster.workers[id].send({
                        message: 'archive',
                        data: data
                    });
                    logger.debug('%s<----- zmq message %s%j', EOL, EOL, data);
                    this.slaves[hostname || _hostname].sysInfo = data.sysInfo;
                    // this.slaves[hostname || _hostname].status = data.status;
                    break;
                case 'monitor':
                    this.slaves[hostname || _hostname].sysInfo = data.sysInfo;
                    this.slaves[hostname || _hostname].timestamp = data.timestamp;
                    _.setArchiveConfig('slaves', this.slaves);
                    break;
            }
        });
        sock.monitor(500, 0);
        sock.on('disconnect', () => {
            sock.disconnect(address);
            logger.debug('%s is disconnected, original address is %s.', hostname, address);
            delete this.slaves[hostname];
            _.setArchiveConfig('slaves', this.slaves);

            events.sendToSingleCluster({
                message: events.EVENTS.LOST_SLAVE,
                data: this.getAvailableSlaves()
            });
        });
        data.timestamp = Date.now();
        data.sock = sock;
        this.slaves[hostname] = data;
        _.setArchiveConfig('slaves', this.slaves);
    }

    getAvailableSlaves(runiOS) {
        const availableSlaves = _.values(this.slaves).filter(slave => {
            const isAvl = slave.status === STATUS.AVAILABLE;

            if (runiOS) {
                return isAvl && runiOS === slave.supportiOS;
            }

            return isAvl;
        });

        if (!availableSlaves.length) {
            logger.debug('no available slaves to dispatch');
            return;
        }

        return availableSlaves.reduce((previousSlave, currentSlave) => {
            return previousSlave.sysInfo.memory > currentSlave.sysInfo.memory ? previousSlave : currentSlave;
        });
    }

    getSlaveByIp(runiOS, slaveIp) {
        const availableSlaves = _.values(this.slaves).filter(slave => {
            const isAvl = slave.ip === slaveIp;

            if (runiOS) {
                return isAvl && runiOS === slave.supportiOS;
            }

            return isAvl;
        });

        if (!availableSlaves.length) {
            logger.debug('no available slaves to dispatch');
            return;
        }

        return availableSlaves.reduce((previousSlave, currentSlave) => {
            return previousSlave.sysInfo.memory > currentSlave.sysInfo.memory ? previousSlave : currentSlave;
        });
    }

    dispatch(data) {
        if (!this.isReady()) {
            logger.debug('no slave to dispatch');
            return;
        }

        const availableSlave = this.getAvailableSlaves(data.runiOS);

        if (availableSlave) {
            logger.debug('%s----->> dispatch to %s with %s %j', EOL, availableSlave.sysInfo.hostname, EOL, data);
            // availableSlave.status = STATUS.BUSY;
            console.log('devices:', data.serialNumber);
            var serialNumber = data.serialNumber;
            var slaveIp = data.slaveIp;

            if (serialNumber && slaveIp) {
                const redisSlave = this.getAvailableSlaves(data.runiOS, slaveIp);
                redisSlave.sock.send(JSON.stringify(data));

                Object.keys(cluster.workers).forEach((id) => {
                    cluster.workers[id].send({
                        message: 'dispatchSuccess',
                        data: data,
                        slave: availableSlave
                    });
                });

            } else {
                console.log('该任务没有指定设备');

                availableSlave.sock.send(JSON.stringify(data));

                Object.keys(cluster.workers).forEach((id) => {
                    cluster.workers[id].send({
                        message: 'dispatchSuccess',
                        data: data,
                        slave: availableSlave
                    });
                });
            }
        } else {
            logger.debug('no available slave to dispatch');
        }
    }

    isReady() {
        return Object.keys(this.slaves).length;
    }

    monitor() {
        setInterval(() => {
            if (!this.isReady()) {
                logger.debug('no slave for monitor #1');
                return;
            }
            for (let slave in this.slaves) {
                this.slaves[slave].sock.send(JSON.stringify({
                    type: 'monitor',
                    timestamp: Date.now()
                }));
            }
        }, 5 * 1000);

        setInterval(() => {
            if (!this.isReady()) {
                logger.debug('no slave for monitor #2');
                return;
            }
            var timestamp = Date.now();

            for (let slave in this.slaves) {
                const diffTime = timestamp - this.slaves[slave].timestamp;
                if (diffTime > 30 * 60 * 1000) {
                    delete this.slaves[slave];
                    logger.debug('%s is disconnected, due to timeout for 30mins.', slave);
                    _.setArchiveConfig('slaves', this.slaves);
                }
            }
        }, 60 * 1000);
    }
}

module.exports = Manager;
