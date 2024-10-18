const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");

const cliArgs = process.argv.slice(2);

const command = cliArgs[0];

const createVCSDirectory = () => {
  fs.mkdirSync(path.resolve(".vcs", "objects"), { recursive: true });
  fs.mkdirSync(path.resolve(".vcs", "refs"), { recursive: true });
  fs.writeFileSync(path.resolve(".vcs", "HEAD"), "ref: refs/heads/main\n");
  console.log("Initialized empty repository");
};

const hashObject = (filePath) => {
  try {
    // get size and data from file and create the blob string
    const { size } = fs.statSync(filePath);
    const data = fs.readFileSync(filePath, "utf8");
    const content = `blob ${size}\0${data}`;

    //hash
    const hash = crypto.createHash("sha1").update(content).digest("hex");

    //get directory and file name
    const objDir = hash.substring(0, 2);
    const objFile = hash.substring(2);

    //Create Directory
    fs.mkdirSync(path.resolve(".vcs", "objects", objDir), { recursive: true });

    //write zipped content to the file
    fs.writeFileSync(
      path.resolve(".vcs", "objects", objDir, objFile),
      zlib.gzipSync(content),
    );

    return hash;
  } catch (e) {
    console.error("Error reading File", e);
  }
};

const catFile = (hash) => {
  const objDir = hash.substring(0, 2);
  const objFile = hash.substring(2);
  const zippedData = fs.readFileSync(
    path.resolve(".vcs", "objects", objDir, objFile),
  );
  const unzip = zlib.gunzipSync(zippedData).toString();
  const res = unzip.split("\0")[1];
  process.stdout.write(res);
};

const lSTree = (hash) => {
  if (!hash) {
    console.log("Hash is required for ls-tree.");
    return;
  }

  const objDir = hash.substring(0, 2);
  const objFile = hash.substring(2);
  const zippedData = fs.readFileSync(
    path.resolve(".vcs", "objects", objDir, objFile),
  );
  const content = zlib.gunzipSync(zippedData).toString();
  console.log(content,"content")
  const idx = content.indexOf("\0");
  const realContent = content.substring(idx);
  console.log(realContent)
  
  

  const entries = content.split("\0").slice(1);
  
  console.log(entries,"entries");
};

const writeTree = (dirPath) => {
  let res = "";
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.resolve(dirPath, file);
    if (file === ".vcs") {
      return;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      const hash = writeTree(fullPath);
      res += `040000 ${file}\0${hash}`;
    } else {
      const hash = hashObject(fullPath);
      res += `100644 ${file}\0${hash}`;
    }
  });

  const content = `tree ${res.length}\0${res}`;
  const hash = crypto.createHash("sha1").update(content).digest("hex");

  const treeDir = hash.substring(0, 2);
  const treeFile = hash.substring(2);
  fs.mkdirSync(path.resolve(".vcs", "objects", treeDir), { recursive: true });
  fs.writeFileSync(
    path.resolve(".vcs", "objects", treeDir, treeFile),
    zlib.gzipSync(content),
  );
  return hash;
};

switch (command) {
  case "init":
    createVCSDirectory();
    break;
  case "hash-object":
    hashObject(cliArgs[1]);
    break;
  case "cat-file":
    catFile(cliArgs[1]);
    break;
  case "ls-tree":
    lSTree(cliArgs[1]);
    break;
  case "write-tree":
    writeTree(process.cwd());
    break;
  default:
    console.log(`Unknown command: ${command}`);
}
