'use strict';
const models = require('../../../../common/models');
const _ = require('../../../../common/utils/helper');
const logger = require('../../../../common/utils/logger');
var path = require('path');
var fs = require('fs');

// 结果返回
function* test() {

  try {
    var files = this.request.files;
    if (files.length > 0) {
      for (var item in files) {
        var tempPath = files[item]['path'];
        var name = files[item]['name'];
        var nameArray = name.split('.');
        var destDir = path.join(__dirname, '../../../', '..', '.temp', nameArray[0]);
        var file = path.join(destDir, 'aaa'+name);

        var promise = new Promise(function (resolve, reject) {
          var out = fs.createReadStream(tempPath).pipe(
            fs.createWriteStream(file)//创建一个可写流  
          );
          out.on('finish', function () {
            resolve("OK");
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
    this.body = {
      success: false,
      errorMsg: 'slave上传结果失败',
      data: null
    };
  }
}

function* dispatch() {
  yield test.call(this);
}

module.exports = dispatch;
