'use strict';
#testdff
var semver = require('semver');
var exec = require('child_process').exec;

module.exports = function(grunt) {

  var DESC = 'Create branch, update version and checkin the changes.';
  grunt.registerTask('createbranch', DESC, function(branchName) {
    var opts = this.options({
      bumpVersion: true,
      branchType: 'release',
      commit: true,
      commitFilesBranch: ['package.json','grunt/config/bumpconfig.json'], // '-a' for all files
      commitFilesMaster: ['package.json'], // '-a' for all files
      commitMessage: 'Changes to  %BRANCH_NAME%',
      createTag: true,
      dryRun: false,
      files: ['package.json'],
      gitCommitOptions: '',
      globalReplace: false,
      prereleaseName: '',
      metadata: '',
      push: true,
      pushTo: 'upstream',
      regExp: false,
      setVersion: false,
      updateConfigs: [], // array of config properties to update (with files)
      branchName: "test"
    });

    var dryRun = grunt.option('dry-run') || opts.dryRun;
    var branchType = grunt.option('branchType') || opts.branchType;
    var branchName = grunt.option('branchName') || opts.branchName
    var setVersion = grunt.option('setVersion') || opts.setVersion;
    if (setVersion && !semver.valid(setVersion)) {
      setVersion = false;
    }
    var releasebranchCreation = true;
    if ( branchType === 'feature'){
        releasebranchCreation = false;
    }
    var globalVersion; // when bumping multiple files

    var PRERELEASE_REGEXP = new RegExp(
      '([\'|\"]?prereleaseName[\'|\"]?[ ]*:[ ]*[\'|\"]?)*[a-zA-Z.-_0-9]*([\'|\"]?)', 'i'
    );
    if (opts.globalReplace) {
      VERSION_REGEXP = new RegExp(VERSION_REGEXP.source, 'gi');
    }

    var done = this.async();
    var queue = [];
    var next = function() {
    grunt.log.ok(" Step no:"+queue.length)
    if (!queue.length) {
        return done();
      }
      queue.shift()();
    };
    var runIf = function(condition, behavior) {
      if (condition) {
        queue.push(behavior);
      }
    };

    if (dryRun) {
      grunt.log.writeln(' Running create branch in dry mode!');
    }

    var checkoutBranch = function(branchtoCheckout) {
        var cmd = "";
        if( branchtoCheckout === "master"){
          cmd = 'git checkout -f master; git pull';
        }else{
          cmd = 'git checkout -b '+branchtoCheckout;
        }
         if (dryRun) {
                grunt.log.ok('branch-dry: Create branch dry: ' + cmd);
                next();
        } else {
                exec(cmd , function(err, stdout, stderr) {
                  if (err) {
                    grunt.fatal(' Can not create the branch:\n  ' + stderr);
                  }
                  grunt.log.ok(' Created branch with Branch name as "' + branchName + '"');
                  next();
                });
        }
    };

    var updatebumpprerelease = function(branchtoCheckout){
        var filepath = 'grunt/config/bumpconfig.json';
        var conf = {};
	var updatedPreReleaseName = "'prereleaseName' : '"+branchtoCheckout +"'";
             if (dryRun) {
                grunt.log.ok(' branch-dry: bump config will be updated with : ' + updatedPreReleaseName);
                next();
        } else {
	  conf =  grunt.file.readJSON(filepath);
          conf.prereleaseName = branchtoCheckout;
	  grunt.file.write(filepath,JSON.stringify(conf));
          next();
        }
    }

    var updateVersion = function( branchToUpdate ){

        grunt.file.expand(opts.files).forEach(function(file, idx) {
                var version = null;
                var content = "";
		 var VERSION_REGEXP = opts.regExp || new RegExp(
					'([\'|\"]?version[\'|\"]?[ ]*:[ ]*[\'|\"]?)(\\d+\\.\\d+\\.\\d+(-[A-a|0-9|.\-]*\\.\\d+)?(-\\d+)?)[\\d||A-a|.|-]*([\'|\"]?)', 'i' );
                if ( branchType === 'release'){
			if( branchToUpdate === "master"){

				content =  grunt.file.read(file).replace(
				  VERSION_REGEXP,
				  function(match, prefix, parsedVersion, namedPre, noNamePre, suffix) {
				   grunt.log.ok("  Current version in package.json "+ parsedVersion);
				    version = semver.inc(
				      parsedVersion.substr(0, parsedVersion.indexOf("-")), 'minor',  opts.prereleaseName
				    );
				    version += "-"+branchToUpdate+".0"

				    grunt.log.ok("  Version of master after updation "+ version);
				    return prefix + version + (suffix || '');
				  }
				);
			}else{
			      content =  grunt.file.read(file).replace(
				  VERSION_REGEXP,
				  function(match, prefix, parsedVersion, namedPre, noNamePre, suffix) {
				    grunt.log.ok("  Current version in package.json "+parsedVersion)
				    version = setVersion || semver.inc(
				      parsedVersion.substr(0, parsedVersion.indexOf("-")), 'patch',  opts.prereleaseName
				    );
				     if ( ! setVersion ) {
					version += "-"+branchToUpdate+".0"
				    }
				    grunt.log.ok("  Version of "+ branchToUpdate + " after updation"+ version);
				    return prefix + version + (suffix || '');
				  }
				);
			}
		} else if ( branchType === 'feature'){
		   content =  grunt.file.read(file).replace(
				  VERSION_REGEXP,
				  function(match, prefix, parsedVersion, namedPre, noNamePre, suffix) {
				    grunt.log.ok("  Current version in package.json "+parsedVersion);
				    version = setVersion || parsedVersion.substr(0, parsedVersion.indexOf("-"))+"-"+branchToUpdate+".0"
				    grunt.log.ok("  Version of "+ branchToUpdate + " after updation"+ version);
				    return prefix + version + (suffix || '');
				  }
				);
		}

                if (!version) {
                  grunt.fatal(' Can not find a version to update in ' + file);
                }
                var logMsg = ' Version updated to ' + version +  ' (in ' + file + ')';

                if (!dryRun) {
                  grunt.file.write(file, content);
                  grunt.log.ok(logMsg);
                } else {
                  grunt.log.ok("branch-dry:"+ logMsg);
                }
      });
      next();
    };

    var commitChanges = function ( branchToCommit ){
        var commitMessage = opts.commitMessage.replace(
                '%BRANCH_NAME%', branchToCommit
      );
      var cmd = "";
      if( branchToCommit === 'master'){
	 cmd = 'git commit ' + opts.gitCommitOptions + ' ' + opts.commitFilesMaster.join(' ');
      } else {
	 cmd = 'git commit ' + opts.gitCommitOptions + ' ' + opts.commitFilesBranch.join(' ');
      }
      cmd += ' -m "' + commitMessage + '"';
       if (dryRun) {
          grunt.log.ok(' branch-dry: ' + cmd);
          next();
        } else {
                exec(cmd, function(err, stdout, stderr) {
                  if (err) {
                    grunt.fatal('Can not create the commit:\n  ' + stderr);
                  }
                  grunt.log.ok('Committed as "' + commitMessage + '"');
                 next();
                });
        }


    }

    var pushChanges = function( branchToPush ){
      var cmd;
      if (branchToPush === "master") {
        cmd = 'git pull; git push origin master';
      }else{
	cmd = "gitl pull; git push origin "+branchToPush;
      }
        if (dryRun) {
          grunt.log.ok(' branch-dry: ' + cmd);
          next();
        } else {
          exec(cmd, function(err, stdout, stderr) {
            if (err) {
              grunt.fatal(
                'Can not push to the git default settings:\n ' + stderr
              );
            }
            grunt.log.ok('Pushed to the git default settings');
            next();
          });
        }

        return;
     }

if ( branchType === 'release'){
    // checkout the release branch
    runIf(true, function() {
       grunt.log.ok('Checkout a release branch');
       checkoutBranch(branchName);
    });
    // update the prereleasename in bumpconfig.json
     runIf(true, function() {
        grunt.log.ok('Update prerelease name in bumpconfig.json');
        updatebumpprerelease(branchName);

    });

    // BUMP ALL FILES
    runIf(true, function() {
        grunt.log.ok('Update version in package.json');
        updateVersion(branchName);

    });

    // COMMIT
    runIf(true, function() {
     grunt.log.ok('Commit Changes');
     commitChanges(branchName);
    });

     // PUSH CHANGES
   runIf(opts.push, function() {
      grunt.log.ok('Push Changes');
       pushChanges(branchName);
   });

     //checkout master
    runIf(true, function() {
       grunt.log.ok('Checkout master branch');
       checkoutBranch("master");
    });

    // BUMP ALL FILES
   runIf(true, function() {
	grunt.log.ok('Update version in package.json');
        updateVersion("master");

   });

    // COMMIT
    runIf(true, function() {
    grunt.log.ok('Commit Changes');
    commitChanges("master");
    });

     // PUSH CHANGES
    runIf(opts.push, function() {
	grunt.log.ok('Push Changes to master');
     pushChanges(branchName);
    });
 } else if ( branchType === 'feature'){
   runIf(true, function() {
       grunt.log.ok('Checkout feature branch');
       checkoutBranch(branchName);
    });
    // update the prereleasename in bumpconfig.json
     runIf(true, function() {
        grunt.log.ok('Update prerelease name in bumpconfig.json');
        updatebumpprerelease(branchName);

    });

    // BUMP ALL FILES
    runIf(true, function() {
        grunt.log.ok('Update version in package.json');
        updateVersion(branchName);

    });

    // COMMIT
    runIf(true, function() {
     grunt.log.ok('Commit Changes');
     commitChanges(branchName);
    });

     // PUSH CHANGES
   runIf(opts.push, function() {
         grunt.log.ok('Push Changes');
       pushChanges(branchName);
   });

 }
    next();
  });
}
