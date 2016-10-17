#!/usr/bin/env node

'use strict';

const fs = require('fs');
const parse5 = require("parse5");
const treeAdapter = parse5.treeAdapters.default;

const filePath = process.argv[2];
const separator = '/';
const ignoreFolders = [
    "test", "demo"
]

if(!filePath){
    const msg = "polymer-imports require first argument to be a file path to the file for inspection, got: " + filePath;
    throw new Error(msg)
}

//stop here if not .html
if (filePath.lastIndexOf('.html') !== filePath.length - 5) {
    console.log("not a polymer element, exiting")
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

const oldImportsMap = findAndRemoveOldImports(d);


const nodeToInsertBefore = d.childNodes[0];

sortedImports.forEach(function (importSection) {
    if (importSection.name) {
        addComment(d, importSection.name + ' elements');
    }
    importSection.imports.forEach(function (importUrl, i) {
        var attrs = oldImportsMap[importUrl] ? oldImportsMap[importUrl] :
            [{
                name: 'rel',
                value: 'import'
            }, {
                name: 'href',
                value: importUrl
            }];

        addLink(d, attrs, importSection.imports.length !== i + 1)
        delete oldImportsMap[importUrl];
    });
});

//Add old imports
var keys = Object.keys(oldImportsMap);
if (keys.length) {
    addComment(d, 'UNUSED DIRECTLY');
    keys.forEach(function (key, i) {
        var attrs = oldImportsMap[key];
        addLink(d, attrs, keys.length !== i + 1)
    })
}

fs.writeFileSync(filePath, parse5.serialize(d, {booleanAttributes: true}));


//Methods
function addLink(document, attrs, addLineBreak) {
    var importNode = treeAdapter.createElement('link', 'http://www.w3.org/1999/xhtml', attrs);
    treeAdapter.insertBefore(document, importNode, nodeToInsertBefore);
    addLineBreak && treeAdapter.insertTextBefore(document, '\n', nodeToInsertBefore);
}
function addComment(document, text) {
    var comment = treeAdapter.createCommentNode(text);
    treeAdapter.insertTextBefore(document, '\n\n', nodeToInsertBefore)
    treeAdapter.insertBefore(document, comment, nodeToInsertBefore);
    treeAdapter.insertTextBefore(document, '\n', nodeToInsertBefore);
}

function getElementNameFromImportPath(path) {
    return path.replace(".html", "").replace(/.*\//g, "");
}

function findAndRemoveOldImports(d) {
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
                importsMap[attrMap["href"]] = el.attrs;
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
            checkAttributes(node.attrs, aggregatorObject);
            aggregatorObject[name] = '';
        }
        collectAllWebComponentsTagNames(node, aggregatorObject);
    });

    //if script tag, check if it has Polymer({ inside
    if (documentFragment.nodeName === "#text" && documentFragment.parentNode.nodeName === "script") {
        checkPolymerObject(documentFragment.value, aggregatorObject);
    }
}

function getParentDir(path) {
    return path.substr(0, path.lastIndexOf(separator));
}

function findRootDir(filePath) {
    var parentDir = getParentDir(filePath);
    while (parentDir.indexOf(separator) !== -1) {
        var files = fs.readdirSync(parentDir);
        if (files.indexOf('polymer.json') !== -1) {
            return parentDir;
        }
        parentDir = getParentDir(parentDir);
    }
    var err = "No polymer.json file found. Can't find root directory for polymer project. File path: ".concat(filePath)
    throw new Error(err)
}

function resolveResources(dir, nodesObject, checkBowerComponentsFolder) {
    fs.readdirSync(dir).forEach(function (content) {
        var path = dir + separator + content;
        if (content.indexOf(".") !== 0 && fs.lstatSync(path).isDirectory() && ignoreFolders.indexOf(content) == -1 && (checkBowerComponentsFolder || content !== "bower_components")) {
            resolveResources(path, nodesObject)
        } else if (content.substr(content.length - 5, 5) === ".html" && nodesObject.hasOwnProperty(getElementNameFromImportPath(content))) {
            const relativePathToRoot = relativePrefix + path.substr(rootDir.length + 1, 999);
            nodesObject[content.substr(0, content.length - 5)] = relativePathToRoot;
        }
    });
}

function checkAttributes(attrs, aggregatorObject) {
    attrs.forEach(function (attr) {
        //check icons
        if (attr.name == "icon" && !isImageUrl(attr.value)) {
            var split = attr.value.split(":")
            if (split.length == 1) {
                aggregatorObject["iron-icons"] = '';
            } else {
                var name = split[0];
                if (name.indexOf('-') === -1) {
                    name += "-icons"
                }
                aggregatorObject[name] = '';
            }
        } //check animations
        else if (attr.name == "entry-animation" || attr.name == "exit-animation") {
            aggregatorObject[attr.value] = '';
        }
    })
}

function checkPolymerObject(string, aggregatorObject) {
    var trim = string.trim();
    if (trim.match(/Polymer\(/gm)) {

        //check behaviors
        var behaviorsDraftArr = trim.match(/behaviors\s*:\s*\[[^\]]*/g);
        if (behaviorsDraftArr && behaviorsDraftArr.length) {
            var behaviorsDraft = behaviorsDraftArr[0];
            behaviorsDraft = behaviorsDraft + '"]';
            behaviorsDraft = behaviorsDraft.replace(",", '","').replace(/behaviors\s*:\s*\[/, '["').replace(/\s*/g, "");
            var behaviors = JSON.parse(behaviorsDraft);
            behaviors.forEach(function (behavior) {
                behavior = behavior.replace(',', "").trim();
                if (behavior.length) {
                    var name = behavior.split(".");
                    name = name[name.length - 1].replace(/,/g, "");
                    aggregatorObject[decamelcase(name)] = '';
                }
            })
        }

        //check animations
        try {
            var polymerObj

            function Polymer(obj) {
                polymerObj = obj;
            }

            //hacky part. Before eval we need to replace all 'deep' calls to avoid ReferenceError
            //get all problem calls
            const problemCalls = trim.match(/(\s|,|:)\w*\.(\$|\w|\.)*/g);
            var FAKE_SCOPE = {};
            problemCalls.forEach(function (pc) {
                const fakeCall = pc.replace(/\w*\.(\$|\w|\.)*/, "FAKE_SCOPE");
                trim = trim.replace(pc, fakeCall);
            });

            eval(trim);

            if (polymerObj.properties && polymerObj.properties.animationConfig && typeof polymerObj.properties.animationConfig.value === "function") {
                var ac = polymerObj.properties.animationConfig.value();
                Object.keys(ac).forEach(function (animationKey) {
                    var animation = ac[animationKey];
                    if (animation.length) {
                        animation.forEach(function (a) {
                            if (a.name) {
                                aggregatorObject[a.name] = '';
                            }
                        })
                    } else if (animation.name) {
                        aggregatorObject[animation.name] = '';
                    }
                })
            }
        } catch (e) {
            console.error("Can not parse js part of polymer element. Most probably because there is something else in 'script' tag, " +
                "try to put third party code into different script tags.", e)
        }
    }
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
        } else if(importsObject[key]){
            var firstName = extractElementsName(importsObject[key]);
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

function extractElementsName(path) {
    var arr = path.split(separator);
    var lastIndexOfWebComponentName = arr.length - 1;
    for (var i = arr.length - 1; i !== -1; i--) {
        if (arr[i].indexOf("-") !== -1) {
            lastIndexOfWebComponentName = i;
        }
    }
    return arr[lastIndexOfWebComponentName].replace(/-.*/, '');
}

function isImageUrl(value) {
    return !!value.match(/(\/|\.)/)
}

function decamelcase(string) {
    return string.match(/([A-Z]?[^A-Z]*)/g).slice(0, -1).join('-').toLowerCase();
}