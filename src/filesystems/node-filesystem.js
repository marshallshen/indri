
var static= require('node-static');
var fs = require('fs');
var path = require('path');
var http = require('http');
var util = require('util');

var config = {};

var previewRegEx = null;


function isValidFile(fileName) {
	return fileName[0] != '.';
}

function fsUrl() {
  var url = config.useHttps ? 'https://' : 'http://';
  url += config.serverName;
  if (config.serverPort != 80 && config.serverPort != 443)
    url += ':' + config.serverPort;
  return url;
}

function isPreviewable(fullPath) {
	if(!config.previewTypes) {
		return null;
	}
	
	if(!previewRegEx) {
		previewRegEx = new RegExp(config.previewTypes);
	}

	return fullPath && fullPath.match(previewRegEx);
}

function getPreviewUrl(fullPath) {
	return isPreviewable(fullPath) ? (fsUrl() + fullPath.slice(config.rootDir.length)) : null;
}

function getFileInfo(fullPath) {

	var previewUrl = getPreviewUrl(fullPath);

	var stats = fs.statSync(fullPath);
	return { 
		name: path.basename(fullPath),
		location: encodeLocation(fullPath.slice(config.rootDir.length)),
		isDir: stats.isDirectory(),
		size: (stats.isFile() ? stats.size : undefined),
		created: stats.ctime.getTime(),
		modified: stats.mtime.getTime(),
		id: stats.ino,
		previewUrl : previewUrl,
	};
}

function constrainPath(path) {
	// TODO Apply constraints
	//return (path.indexOf(config.rootDir) != 0) ? config.rootDir : path;
	return path;
}

function parseLocation(location) {
	return location ? JSON.parse(location) : "/";
}

function encodeLocation(location) {
	return JSON.stringify(location);
}

function handleFileRequest(req, res) {
	try {
		console.log(req.url);
		var result = { };

		var parsedQuery = require('url').parse(req.url, true);
		//console.log('parsed query:', parsedQuery);

    // if action is undefined serve the file
		var action = parsedQuery.query.action || "browse";
		var loc = parseLocation(parsedQuery.query.loc);
		console.log(parsedQuery.query.loc, ' -> ', loc);

		if(action == "navigate") {
			result.origLoc = loc;
			var direction = parsedQuery.query.direction;
			if(direction == "parent") {
				if(loc != "/") {
					loc = path.dirname(loc);
				}
			}
			console.log(loc);
      result.loc = encodeLocation(loc);
			console.log(result);
		}
		else if(action == "browse") {
			result.realLoc = constrainPath(path.join(config.rootDir, loc));
			result.loc = loc = result.realLoc.slice(config.rootDir.length);

			result.contents = [];
			fs.readdirSync(result.realLoc).forEach(function(fileName) {
				if(isValidFile(fileName)) {
					result.contents.push(getFileInfo(path.join(result.realLoc, fileName)));
				}
			});
		}
		else if(action == "rename") {
			if(!parsedQuery.query.loc) {
				throw "Missing location";
			}

			var newName = parsedQuery.query.newName;
			if(!newName) {
				result.error = "No new name supplied for rename";
			}
			else {
				var oldFile = path.join(config.rootDir, loc);
				if(fs.existsSync(oldFile)) {
					var newFile = path.join(path.dirname(oldFile), newName);

					result.oldFile = oldFile;
					result.newFile = newFile;

					fs.renameSync(oldFile, newFile);
					result.contents = [getFileInfo(newFile)];
				}
				else {
					result.error = "File doesn't exist: " + loc;
				}
			}
		}
		else if(action == "delete") {
			if(!parsedQuery.query.locs) {
				throw "Missing locations to delete";
			}

			var locations = JSON.parse(parsedQuery.query.locs);
			result.locations = locations;

			result.attempt = [];
			result.failure = {};

			result.contents = [];

			locations.forEach(function(location) {
				location = parseLocation(location);
				if(location.length) {
					var fullPath = path.join(config.rootDir, location);
					result.attempt = fullPath;

					try {
						var fileInfo = getFileInfo(fullPath);

						var stats = fs.statSync(fullPath);
						if(stats.isFile()) {
							fs.unlinkSync(fullPath);
						}
						else {
							fs.rmdirSync(fullPath);
						}

						result.contents.push(fileInfo);
					}
					catch(ex) {
						result.failure[fullPath] = ex;
					}
				}
			});
		}
		else if(action == "makedir") {
			if(!parsedQuery.query.name) {
				throw "Missing new folder name";
			}

			var fullPath = path.join(config.rootDir, loc, parsedQuery.query.name);
			result.attemp = fullPath;

			fs.mkdirSync(fullPath);
			result.contents = [getFileInfo(fullPath)];
		}
		else if(action == 'shortcuts') {
    		result.contents = [];
    		if(config.shortcuts) {
                config.shortcuts.forEach(function(item) {
                    result.contents.push({name: item.name, location: encodeLocation(item.location)});
                });
            }
		}
		else {
			result.error = "Invalid action";
			result.action = action;
			result.loc = loc;
		}
	}
	catch(ex) {
		console.log("Exception: " + ex);

		result.error = "Error accessing " + loc;
		result.exception = ex.toString();
	}
	res.end(JSON.stringify(result) + '\n');
}


var configFile = (process.argv.length > 2) ? process.argv[2] : './config-default.json';
console.log("Parsing settings from: ", configFile);
fs.readFile(configFile, 'utf8', function (err, data) {
  if (err) {
    console.log('Error: ' + err);
    return;
  }

  config = JSON.parse(data);
  var file = new(static.Server)(config.rootDir, { 
    cache: 600, 
    headers: { 'X-Powered-By': 'node-static' } 
  });

  http.createServer(function (req, res) {
    var parsedQuery = require('url').parse(req.url, true);

    console.log('parsed query:', parsedQuery.query);
    // if action is undefined serve the file
    if (parsedQuery.query.action == undefined) {
      file.serve(req, res, function(err, result) {
        if (err) {
          console.error('Error serving %s - %s', req.url, err.message);
          if (err.status === 404 || err.status === 500) {
            file.serveFile(util.format('/%d.html', err.status), err.status, {}, req, res);
          } else {
            res.writeHead(err.status, err.headers);
            res.end();
          }
        } else {
          console.log('%s - %s', req.url, res.message); 
        }
      });
    } else {
      res.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'});
      handleFileRequest(req, res);
    }
  }).listen(process.env.PORT || config.serverPort);
  console.log('Server running at http://' + config.serverName + ':' + config.serverPort);
  console.log('Serving files from ', config.rootDir);
});
