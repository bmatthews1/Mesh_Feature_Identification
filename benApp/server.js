let dirName = './';

const fs   = require('fs');
const http = require('http');
const path = require('path');
const url  = require('url');

const port = 8000;
const host = "localhost";
const directoryName = process.argv[2] || dirName;

//MIME types
const types = {
    "aac": "audio/aac",
    "abw": "application/x-abiword",
    "ai": "application/postscript",
    "arc": "application/octet-stream",
    "avi": "video/x-msvideo",
    "azw": "application/vnd.amazon.ebook",
    "bin": "application/octet-stream",
    "bz": "application/x-bzip",
    "bz2": "application/x-bzip2",
    "csh": "application/x-csh",
    "css": "text/css",
    "csv": "text/csv",
    "doc": "application/msword",
    "dll": "application/octet-stream",
    "eot": "application/vnd.ms-fontobject",
    "epub": "application/epub+zip",
    "gif": "image/gif",
    "glb": "model/gltf-binary",
    "htm": "text/html",
    "html": "text/html",
    "ico": "image/x-icon",
    "ics": "text/calendar",
    "jar": "application/java-archive",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "js": "application/javascript",
    "json": "application/json",
    "mid": "audio/midi",
    "midi": "audio/midi",
    "mp2": "audio/mpeg",
    "mp3": "audio/mpeg",
    "mp4": "video/mp4",
    "mpa": "video/mpeg",
    "mpe": "video/mpeg",
    "mpeg": "video/mpeg",
    "mpkg": "application/vnd.apple.installer+xml",
    "odp": "application/vnd.oasis.opendocument.presentation",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "odt": "application/vnd.oasis.opendocument.text",
    "oga": "audio/ogg",
    "ogv": "video/ogg",
    "ogx": "application/ogg",
    "otf": "font/otf",
    "png": "image/png",
    "pdf": "application/pdf",
    "ppt": "application/vnd.ms-powerpoint",
    "rar": "application/x-rar-compressed",
    "rtf": "application/rtf",
    "sh": "application/x-sh",
    "svg": "image/svg+xml",
    "swf": "application/x-shockwave-flash",
    "tar": "application/x-tar",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "ts": "application/typescript",
    "ttf": "font/ttf",
    "txt": "text/plain",
    "vsd": "application/vnd.visio",
    "wav": "audio/x-wav",
    "weba": "audio/webm",
    "webm": "video/webm",
    "webp": "image/webp",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "xhtml": "application/xhtml+xml",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.ms-excel",
    "xlsx_OLD": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xml": "application/xml",
    "xul": "application/vnd.mozilla.xul+xml",
    "zip": "application/zip",
    "3gp": "video/3gpp",
    "3gp_DOES_NOT_CONTAIN_VIDEO": "audio/3gpp",
    "3gp2": "video/3gpp2",
    "3gp2_DOES_NOT_CONTAIN_VIDEO": "audio/3gpp2",
    "7z": "application/x-7z-compressed"
};

const root = path.normalize(path.resolve(directoryName));

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    const extension = path.extname(req.url).slice(1);
    const type = extension ? types[extension] : types.html;
    const supportedExtension = Boolean(type);

	let parsedUrlObj = url.parse(req.url);
	let query        = parsedUrlObj.query;
	let parsedUrl    = parsedUrlObj.pathname;

	console.log(parsedUrl);
    
    // extract URL path
    // from https://stackoverflow.com/questions/16333790/node-js-quick-file-server-static-files-over-http
    // Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
    // e.g curl --path-as-is http://localhost:9000/../fileInDanger.txt
    // by limiting the path to current directory only
    const sanitizePath = path.normalize(parsedUrl).replace(/^(\.\.[\/\\])+/, '');
    let pathname = path.join(root, sanitizePath);

    if (!supportedExtension) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404: File not found');
        return;
    }

	// let testPath = path.join(root, req.url);
	// redirect files trying to refence directories
	if (fs.existsSync(pathname) && fs.statSync(pathname).isDirectory()) {
		console.log("file is directory");
		if (pathname.indexOf('/', pathname.length - 1) == -1) {
			res.writeHead(302, {
				'Location': parsedUrl + "/",
				//add other headers here...
			});
			res.end();
			return;
		}
	}

	// add index.html onto folder paths
    let fileName = parsedUrl;
    if (parsedUrl === '/') fileName = 'index.html';
    else if (!extension) {
        try {
            accessSync(path.join(root, parsedUrl + '.html'), fs.constants.F_OK);
            fileName = parsedUrl + '.html';
        } catch (e) {
            fileName = path.join(parsedUrl, 'index.html');
        }
    }

    const filePath = path.join(root, fileName);
    const isPathUnderRoot = path.normalize(path.resolve(filePath)).startsWith(root);

    if (!isPathUnderRoot) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404: File not found');
        return;
    }

    console.log(`reading file ${fileName} at ${filePath}`);

    fs.readFile(filePath, (err, data) => {
        if (err) {
			if (fileName.split("/").slice(-1)[0] === "index.html"){
				console.log("building index page")
				res.writeHead(200, { 'Content-Type': type });
				let html = buildIndexFile(parsedUrl, filePath);
                if (html === ""){
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('404: File not found');
                    return;
                } else {
                    res.end(html);
                    return;
                }
			}
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('404: File not found');
        } else {
            res.writeHead(200, { 'Content-Type': type });
            res.end(data);
        }
    });
});

let buildIndexFile = (parsedUrl, filePath) => {
	let header = '';
	let body = '';

    try {
        let files = fs.readdirSync(filePath.substring(0, filePath.lastIndexOf("/")) + "/");
        for (let f of files){
            body += `<a href=${parsedUrl+f}>${f}</a><br>`
        }
    } catch (err){
        console.log(err);
        return "";
    }

	return `<!DOCTYPE html><html><head> ${header} </head><body> ${body} </body></html>`;
}

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});