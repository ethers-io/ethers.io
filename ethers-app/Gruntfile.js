'use strict';

var version = require('ethers/package.json').version;

var through = require('through');

var undef = "module.exports = undefined;";
var empty = "module.exports = {};";

var transforms = {
    'hash.js/lib/hash/ripemd.js': 'module.exports = { ripemd160: null }',
    'hash.js/lib/hash/hmac.js': empty,
    'hash.js/lib/hash/sha/1.js': empty,
    'hash.js/lib/hash/sha/224.js': empty,
    'hash.js/lib/hash/sha/384.js': empty,
    'hash.js/lib/hash/sha/512.js': empty,
    'ethers/package.json': ('{ version: "' + version + '"}'),

    // Used by sha3
    "process/.*": undef,
}

function transformFile(path) {
    for (var pattern in transforms) {
        if (path.match(new RegExp('/' + pattern + '$'))) {
            return transforms[pattern];
        }
    }
    return null;
}

function transform(path, options) {
    var data = '';

    return through(function(chunk) {
        data += chunk;
    }, function () {
        var transformed = transformFile(path);
        if (transformed != null) {
            console.log('Modified: ' + path.substring(__dirname.length + 1) + ' => ' + transformed, ' (' + data.length + ' => ' + transformed.length + ')');
            data = transformed;
        } else {
            console.log('Unmodified: ' + path.substring(__dirname.length + 1) + ' (' + data.length + ')');
        }
        this.queue(data);
        this.queue(null);
    });
}

module.exports = function(grunt) {
  grunt.initConfig({
    browserify: {
      library: {
        files: {
          '../dist/scripts/ethers-app-v0.4.js': [ 'ethers-app.js' ],
        },
        options: {
          transform: [
            [ transform, { global: true } ],
          ],
          browserifyOptions: {
          },
        }
      },
    },
    uglify: {
      dist: {
        files: {
          '../dist/scripts/ethers-app-v0.4.min.js' : [ '../dist/scripts/ethers-app-v0.4.js' ],
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('dist', ['browserify', 'uglify']);
};


