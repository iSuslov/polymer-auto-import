const fs = require('fs');
const parse5 = require("parse5");
const treeAdapter = parse5.treeAdapters.default;

const filePath = process.argv[2];
const separator = '/';

//stop here if not .html
if (filePath.lastIndexOf('.html') !== filePath.length - 5) {
    return;
}

const rootDir = findRootDir(filePath);
//calculate prefix for relative path
var relativePrefix = '';
for (var i = 0; i < filePath.substr(rootDir.length, 999).split(separator).length - 2; i++) {
    relativePrefix += ".." + separator;
}

const file = fs.readFileSync(filePath, 'utf8');
const d = parse5.parseFragment(file);

//aggregator object
const allNodeNames = {'polymer': ''};

collectAllWebComponentsTagNames(d, allNodeNames);
resolveResources(rootDir, allNodeNames, true);
var sortedImports = sortResources(allNodeNames);
//aggregator object is full with all information we need

findAndRemoveAllImports(d);

var nodeToInsertBefore = d.childNodes[0];
sortedImports.forEach(function (importSection) {
    if (importSection.name) {
        var comment = treeAdapter.createCommentNode(importSection.name + ' elements');
        treeAdapter.insertTextBefore(d, '\n\n', nodeToInsertBefore)
        treeAdapter.insertBefore(d, comment, nodeToInsertBefore);
        treeAdapter.insertTextBefore(d, '\n', nodeToInsertBefore);
    }
    importSection.imports.forEach(function (importUrl, i) {
        var importNode = treeAdapter.createElement('link', 'http://www.w3.org/1999/xhtml',
            [{name: 'rel', value: 'import'}, {name: 'href', value: importUrl}])
        treeAdapter.insertBefore(d, importNode, nodeToInsertBefore);
        if (importSection.imports.length !== i + 1) {
            treeAdapter.insertTextBefore(d, '\n', nodeToInsertBefore);
        }
    });
})

fs.writeFileSync(filePath, parse5.serialize(d, {booleanAttributes: true}));


//Methods

function getElementNameFromImportPath(path) {
    return path.replace(".html", "").replace(/.*\//g, "");
}

function findAndRemoveAllImports(d) {
    var arr = treeAdapter.getChildNodes(d);
    var importsMap = {};
    var lastIndexOfImport = -1;
    arr.forEach(function (el, i) {
        if (el.tagName === "link") {
            var isImport;
            var attrMap = {};
            el.attrs.forEach(function (attr) {
                if (attr.name === "rel") {
                    isImport = attr.value.toLowerCase() === "import";
                }
                attrMap[attr.name] = attr.value;
            });
            if (isImport && attrMap["href"]) {
                importsMap[getElementNameFromImportPath(attrMap["href"])] = attrMap["href"];
                lastIndexOfImport = i;
            }
        }
    });

    for (var i = 0; i <= lastIndexOfImport; i++) {
        treeAdapter.detachNode(d.childNodes[0]);
    }
    return importsMap;
}

function collectAllWebComponentsTagNames(documentFragment, aggregatorObject) {

    var nodes = documentFragment.childNodes || [];
    var contentNodes = documentFragment.content ? documentFragment.content.childNodes || [] : [];


    nodes.concat(contentNodes).forEach(function (node) {
        var name = node.nodeName;

        if (name.indexOf("dom-") === -1 && name.indexOf("-") !== -1 && !node.attrs.find(function (attr) {
                return attr.name === "noimport";
            })) {
            aggregatorObject[name] = '';
        }
        collectAllWebComponentsTagNames(node, aggregatorObject);
    });
}

function getParentDir(path) {
    return path.substr(0, path.lastIndexOf(separator));
}

function findRootDir(filePath) {
    var parentDir = filePath;
    while (parentDir.indexOf(separator) !== -1) {
        parentDir = getParentDir(parentDir);
        var files = fs.readdirSync(parentDir);
        if (files.indexOf('polymer.json') !== -1) {
            return parentDir;
        }
    }
    var err = "No polymer.json file found. Can't find root directory for polymer project. File path: ".concat(filePath)
    throw new Error(err)
}

function resolveResources(dir, nodesObject, checkBowerComponentsFolder) {
    fs.readdirSync(dir).forEach(function (content) {
        var path = dir + separator + content;
        if (content.indexOf(".") !== 0 && fs.lstatSync(path).isDirectory() && (checkBowerComponentsFolder || content !== "bower_components")) {
            resolveResources(path, nodesObject)
        } else if (content.substr(content.length - 5, 5) === ".html" && nodesObject.hasOwnProperty(getElementNameFromImportPath(content))) {
            const relativePathToRoot = relativePrefix + path.substr(rootDir.length + 1, 999);
            nodesObject[content.substr(0, content.length - 5)] = relativePathToRoot;
        }
    });
}

function sortResources(importsObject) {
    const keys = Object.keys(importsObject);
    const arr = [];
    const classificationMap = {};
    keys.forEach(function (key) {
        if (key === "polymer") {
            arr.unshift({
                name: null,
                imports: [
                    importsObject[key]
                ]
            })
        } else {
            var firstName = key.replace(/-.*/, '');
            firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
            if (!classificationMap[firstName]) {
                classificationMap[firstName] = []
            }
            classificationMap[firstName].push(importsObject[key])
        }
    });

    Object.keys(classificationMap).forEach(function (key) {
        arr.push({
            name: key,
            imports: classificationMap[key]
        })
    })
    return arr;
}