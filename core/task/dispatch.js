'use strict';

const co = require('co');
const cluster = require('cluster');

const Slave = require('../slave');
const models = require('../../common/models');
const _ = require('../../common/utils/helper');
const logger = require('../../common/utils/logger');

const Task = models.Task;
const Project = models.Project;
const Device = models.Device;


module.exports = co.wrap(function *() {
  const task = new Task();
  const taskData = yield task.getExpectedOne();

  if (!taskData) {
    logger.debug('no queue');
    return;
  }

  const project = new Project();
  const projectData = yield project.getById(taskData.projectId);

  if (!projectData) {
    logger.debug('no projectData');
    return;
  }

  let body = projectData.repositoryUrl;

  body += `#${projectData.repositoryBranch}`;
  body += `#${projectData.environment}`;

  process.send({
    message: 'dispatchTask',
    data: {
      body: body,
      taskId: taskData._id,
      type: 'task',
      serialNumber:projectData.serialNumber,
      runiOS: projectData.runiOS
    }
  });
});

module.exports.success = co.wrap(function *(data, slave) {
  const task = new Task();
  yield task.updateById(data.taskId, {
    status: 1,
    slaveId: slave.sysInfo.hostname,
    start_at: Date.now()
  });

  //添加device锁定操作,3->使用中
  const device = new Device();
  yield device.updateBySerialNumber(data.serialNumber, {
    status: global.DEVICE_STATUS.USING
  });

});
