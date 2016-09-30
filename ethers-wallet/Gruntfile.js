module.exports = function(grunt) {
  grunt.initConfig({
    browserify: {
      client: {
        files: {
          '../scripts/ethers-v0.1.js': [ 'client.js' ],
        },
        options: {
          browserifyOptions: {
            standalone: 'ethers'
          }
        }
      },
      wallet: {
        files: {
          '../scripts/ethers-wallet.js': [ 'index.js' ],
        },
        options: {
          browserifyOptions: {
            standalone: 'Wallet'
          }
        }
      },
    },
    uglify: {
      dist: {
        files: {
          '../scripts/ethers-v0.1.min.js' : [ '../scripts/ethers-v0.1.js' ],
          '../scripts/ethers-wallet.min.js' : [ '../scripts/ethers-wallet.js' ],
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('dist', ['browserify', 'uglify']);
};
