'use strict';

const cluster = require('cluster');

const check = require('./check');
const archive = require('./archive');
const project = require('./project');
const dispatch = require('./dispatch');

exports.run = require('./run');

exports.bind = function() {
  if (cluster.isWorker) {
    cluster.worker.on('message', (e) => {
      switch (e.message) {
        //检查项目，为项目创建task
        case 'project':
          project();
          break;

        //分发任务
        case 'dispatch':
          dispatch();
          break;
        case 'dispatchSuccess':
          dispatch.success(e.data, e.slave);
          break;
        case 'archive':
          archive(e.data);
          break;
        //检查任务是否过期，过期，超过一小时扔回到队列
        case 'check':
          check(e);
          break;
        case 'slaveReady':
          process._isReady = true;
          break;
      }
    });
  }
};
