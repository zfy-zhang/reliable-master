'use strict';
const models = require('../../../../common/models');
const _ = require('../../../../common/utils/helper');
const logger = require('../../../../common/utils/logger');
var path = require('path');
var fs = require('fs');
const options = require('../../../../common/config').get();
var request = require('request');
let REQUST = require("co-request");
let co = require("co");
const Project = models.Project;

const Task = models.Task;
const task = new Task();
// 结果返回
function* result() {

  try {
    var files = this.request.files;
    if (files.length > 0) {
      for (var item in files) {
        var tempPath = files[item]['path'];
        var name = files[item]['name'];
        var nameArray = name.split('.');
        var destDir = path.join(__dirname, '../../../', '..', '.temp', nameArray[0]);
        if (fs.existsSync(destDir)) {
          _.rimraf(destDir);
        }
        _.mkdir(destDir);

        var file = path.join(destDir, name);
        console.log(file);

        var thisTaskData = yield task.getById(nameArray[0]);
        var projectId = thisTaskData.projectId;
        const project = new Project();
        const projectData = yield project.getById(projectId);
        var promise = new Promise(function (resolve, reject) {
          var out = fs.createReadStream(tempPath).pipe(
            fs.createWriteStream(file)//创建一个可写流
          );
          out.on('finish', function () {
            resolve("OK");
            upload(file, projectData.resultUrl);
            jobEnd(projectId);
          });
        });

        var resultStr = yield promise;

      }
    }

    this.body = {
      success: true,
      errorMsg: '',
      data: null
    };
  } catch (ex) {
    console.log(ex);
    this.body = {
      success: false,
      errorMsg: 'slave上传结果失败',
      data: null
    };
  }
}

//  //通知业务系统任务结束
function jobEnd(projectId) {
  //
  // var result = request({
  //   uri: 'http://192.1.1.7:9090/demo/services/wsdevice/status/' + projectId,
  //   method: 'get'
  // });

  co(function* () {
      const project = new Project();
      const projectData = yield project.getById(projectId);
      var result = yield REQUST.get({ url:projectData.statusUrl + projectId+"?status=passed"});
      result = yield JSON.parse(result.body);
      return result;

  }).catch(function (err) {
        console.error(err);
    });

}

//将结果上传到业务系统中
function upload(file, businessUrl) {
    try{
        var formData = {
            // my_field: 'my_value',
            // my_buffer: new Buffer([1, 2, 3]),
            attachments: [
                fs.createReadStream(file)
            ],
        };

        request.post({ url: businessUrl, formData: formData }, function optionalCallback(err, httpResponse, body) {
            if (err) {
                return console.error('上传结果到业务系统失败:', err,file);
            }
            console.log('上传结果到业务系统成功:', file);
        });
    }catch (e){
        console.log(e);
        return {
          data:'上传结果到业务系统失败'
        };
    }

}

function* dispatch() {
  yield result.call(this);
}

module.exports = dispatch;
