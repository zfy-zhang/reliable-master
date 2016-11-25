'use strict';
var request = require('../../../../common/utils/request');
var helper = require('../../../../common/utils/helper');
var co = require('co');
const models = require('../../../../common/models');

const Device = models.Device;
const Slave = models.Slave;


/**
 * 刷新所有slave节点，查询该节点设备
 * @returns {{}}
 */
function *refreshAllDevicesBySlaves() {

    //获取redis中的slaves缓存
    var redisSlaves = yield helper.getArchiveConfig('slaves');

    if (Object.keys(redisSlaves || {}).length != 0) {

        var result = [];

        redisSlaves = helper.values(redisSlaves);

        for (var i = 0; i < redisSlaves.length; i++) {

            var redisSlave = redisSlaves[i];

            var ip = redisSlave.ip;
            var webPort = redisSlave.webPort;

            var url = `http://${ip}:${webPort}/devices`;

            //查询数据库中是否已经保存过该slave
            var slave = new Slave();
            const dbSlave = yield slave.getByUrl(url);

            var slaveId;
            //如果没有保存过，则将slave保存到数据库
            if (dbSlave == null) {
                slave.slaveUrl = url;
                yield slave.add();
                slaveId = slave._id
            } else {
                slaveId = dbSlave._id;
                dbSlave.status = 1;
                dbSlave.updateById(slaveId,dbSlave);
            }

            // 查询该slave节点上的所有设备
            var slaveDevices = yield querySlaveDeviceByUrl(url);

            if (slaveDevices) {

                result.push(slaveDevices);

                var slaveDevicesSerialNumbers = [];
                //循环遍历设备
                for (var i = 0; i < slaveDevices.length; i++) {
                    var slaveDevice = slaveDevices[i];
                    var serialNumber = slaveDevice.serialNumber;
                    slaveDevicesSerialNumbers.push(serialNumber);
                    var device = new Device();

                    //根据序列号查询数据库中是否存在该设备
                    const data = yield device.getBySerialNumber(serialNumber);

                    //如果存在，检查库中该设备原先是否挂靠在相同slave上，如果不是，则修改关联关系
                    if (data != null) {
                        console.log("查询到设备", data);

                        //如果设备非使用中
                        if (data.status != 3) {
                            if (slaveId != data.slaveId) {
                                data.slaveId = slaveId;
                            }
                            data.status = slaveDevice.status;
                            data.updated_at = Date.now();

                            yield device.updateById(data._id, data);
                        }
                    } else {
                        console.log("未查询到设备");

                        console.log(slaveDevice);
                        device.slaveId = slaveId;
                        device.serialNumber = serialNumber;
                        device.status = slaveDevice.status;
                        device.brand = slaveDevice.brand;
                        device.model = slaveDevice.model;
                        device.releaseVersion = slaveDevice.releaseVersion;
                        device.sdkVersion = slaveDevice.sdkVersion;
                        device.abi = slaveDevice.abi;
                        var screen = slaveDevice.screen;
                        var arrays = screen.split("x");
                        device.screenWidth = arrays[0];
                        device.screenHeight = arrays[1];

                        device.errorMessage = slaveDevice.errorMessage;
                        yield device.add();

                    }
                }

                //将连接成功后，又拔出的设备设置为不可用
                var update = new Device();
                var data = {
                    status: 4
                };

                yield update.updateBySlaveId(slaveId, slaveDevicesSerialNumbers, data);

            }

        }

        return true;
    } else {
        //如果没有slave，则将原先可用的设备全部设置为不可用
        var update = new Device();
        var data = {
            status: 4
        };

        yield update.updateByStatus(data);

        //如果没有slave，则将slaves全部设置为不可用
        var update = new Slave();
        var data = {
            status: 2
        };

        yield update.updateByStatus(data);
        return true;
    }
}

/**
 * 查询当前有效的设备
 */
function *queryValidDevices() {
    var device = new Device();
    var result = yield device.queryValidDevices();
    return result;
}

/**
 * 根据url查询某个slave上的设备信息
 * @param slave
 * @returns {*}
 */
function *querySlaveDeviceByUrl(url) {

    var result = yield request({
        uri: url,
        method: 'get'
    });

    try {
        result = JSON.parse(result.body);
        return result;
    } catch (e) {
        return false;
    }
}


function *dispatch() {

    switch (this.params.method) {
        //刷新设备
        case 'devices_refresh':
            this.body = yield refreshAllDevicesBySlaves.call(this);
            break;
        //查询有效设备
        case 'devices':
            this.body = yield queryValidDevices.call(this);
            break;
    }

}

module.exports = dispatch;
