// node-thumbnail
// (c) 2012-2017 Honza Pokorny
// Licensed under BSD
// https://github.com/honza/node-thumbnail

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var os = require('os');

var im = require('imagemagick');
var async = require('async');
var _ = require('underscore');

var options, queue, defaults, done, extensions, createQueue, run;


defaults = {
  prefix : '',
  suffix: '_thumb',
  digest: false,
  hashingType: 'sha1',
  width: 800,
  concurrency: os.cpus().length,
  quiet: false,
  overwrite: false,
  logger: function(message) {
    console.log(message); // eslint-disable-line no-console
  }
};


extensions = [
  '.jpg',
  '.jpeg',
  '.JPG',
  '.JPEG',
  '.png',
  '.PNG',
  '.gif',
  '.GIF'
];


createQueue = function(settings) {

  queue = async.queue(function(task, callback) {

    if (settings.digest) {

      var hash = crypto.createHash(settings.hashingType);
      var stream = fs.ReadStream(task.options.srcPath);

      stream.on('data', function(d) {
        hash.update(d);
      });

      stream.on('end', function() {
        var d = hash.digest('hex');

        task.options.dstPath = settings.destination + '/' + d + '_' +
          settings.width + path.extname(task.options.srcPath);

        if (settings.overwrite || !fs.existsSync(task.options.dstPath)) {
          im.resize(task.options, function(err, stdout, stderr) {
            callback();
          });
        }

      });

    } else {
      var name = task.options.srcPath;
      var ext = path.extname(name);
      var base = task.options.basename || path.basename(name, ext);

      task.options.dstPath = settings.destination + '/' + settings.prefix + base +
        settings.suffix + ext;

      if (settings.overwrite || !fs.existsSync(task.options.dstPath)) {
        im.resize(task.options, function(err, stdout, stderr) {
          callback();
        });
      }
    }

  }, settings.concurrency);

  queue.drain = function() {
    if (done) {
      done();
    } else {
      if (!settings.quiet) {
        settings.logger('all items have been processed');
      }
    }
  };
};


run = function(settings) {
  var images;

  if (fs.statSync(settings.source).isFile()) {
    images = [path.basename(settings.source)];
    settings.source = path.dirname(settings.source);
  } else {
    images = fs.readdirSync(settings.source);
  }

  images = _.reject(images, function(file) {
    return _.indexOf(extensions, path.extname(file)) === -1;
  });

  createQueue(settings);

  _.each(images, function(image) {

    options = {
      srcPath: settings.source + '/' + image,
      width: settings.width,
      basename: settings.basename
    };

    queue.push({options: options}, function() {
      if (!settings.quiet) {
        settings.logger(image);
      }
    });

  });
};


exports.thumb = function(options, callback) {
  var settings;

  if (options.args) {

    if (options.args.length != 2) {
      options.logger('Please provide a source and destination directories.');
      return;
    }

    options.source = options.args[0];
    options.destination = options.args[1];

  }

  var sourceExists = fs.existsSync(options.source);
  var destExists = fs.existsSync(options.destination);

  settings = _.defaults(options, defaults);

  if (sourceExists && !destExists) {
    options.logger('Destination \'' + options.destination + '\' does not exist.');
    return;
  } else if (destExists && !sourceExists) {
    options.logger('Source \'' + options.source + '\' does not exist.');
    return;
  } else if (!sourceExists && !destExists) {
    options.logger('Source \'' + options.source + '\' and destination \'' + options.destination + '\' do not exist.');
    return;
  }

  if (callback) {
    done = callback;
  }

  run(settings);

};
