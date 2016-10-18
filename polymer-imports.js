#!/usr/bin/env node

const fs = require('fs');
const filePath = process.argv[2];

if (!filePath) {
    const msg = "polymer-imports require first argument to be a file path to the file for inspection, got: " + filePath;
    throw new Error(msg)
}
//stop here if not .html
if (!hasExtension(filePath, "html")) {
    console.log("Not a html file, exiting")
    return;
}

const parse5 = require("parse5");
const treeAdapter = parse5.treeAdapters.default;
const separator = '/';
var isDemo = false;

const config = {
    rootDir: '',
    bowerFolderName: "bower_components",
    ignoredFolders: ["test", "demo"],
    ignoredComponents: [],
    animationAttributes: [
        "entry-animation",
        "exit-animation"
    ],
    resolve: {
        "iron-flex": "iron-flex-layout-classes",
        "iron-flex-reverse": "iron-flex-layout-classes",
        "iron-flex-alignment": "iron-flex-layout-classes",
        "iron-flex-factors": "iron-flex-layout-classes",
        "iron-positioning": "iron-flex-layout-classes"
    }
}
const rootDir = findRootDir(filePath, parseOptionalArguments(process.argv[3], process.argv[4]));

//calculate prefix for relative path
var relativePrefix = '';
for (var i = 0; i < filePath.substr(rootDir.length, 999).split(separator).length - 2; i++) {
    relativePrefix += ".." + separator;
}

const file = fs.readFileSync(filePath, 'utf8');
const isFragment = file.indexOf("<html") === -1;
const d = isFragment ? parse5.parseFragment(file) : parse5.parse(file);

//aggregator object
const allNodeNames = isFragment ? {'polymer': ''} : {};

collectAllWebComponentsTagNames(d, allNodeNames);
resolveResources(rootDir, allNodeNames, true);
var sortedImports = sortResources(allNodeNames);
//aggregator object is full with all information we need

const tagsToRemove = [];
const oldImportsMap = findOldImportsAndCreateImportsNode(d);
var nodeToInsertBefore;

sortedImports.forEach(function (importSection) {
    if (importSection.name) {
        addComment(importSection.name + ' elements', nodeToInsertBefore);
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

        addLink(attrs, importSection.imports.length !== i + 1, nodeToInsertBefore)
        delete oldImportsMap[importUrl];
    });
});

//Add unused imports
var keys = Object.keys(oldImportsMap);
if (keys.length) {
    addComment('UNUSED DIRECTLY', nodeToInsertBefore);
    keys.forEach(function (key, i) {
        var attrs = oldImportsMap[key];
        addLink(attrs, keys.length !== i + 1, nodeToInsertBefore)
    })
}

//Remove old imports
tagsToRemove.forEach(function (el) {
    treeAdapter.detachNode(el);
})

fs.writeFileSync(filePath, parse5.serialize(d, {booleanAttributes: true}));


//Methods
function addLink(attrs, addLineBreak, nodeToInsertBefore) {
    var importNode = treeAdapter.createElement('link', 'http://www.w3.org/1999/xhtml', attrs);
    treeAdapter.insertBefore(nodeToInsertBefore.parentNode, importNode, nodeToInsertBefore);
    treeAdapter.insertTextBefore(nodeToInsertBefore.parentNode, '\n', nodeToInsertBefore);
}
function addComment(text, nodeToInsertBefore) {
    var comment = treeAdapter.createCommentNode(text);
    treeAdapter.insertTextBefore(nodeToInsertBefore.parentNode, '\n', nodeToInsertBefore)
    treeAdapter.insertBefore(nodeToInsertBefore.parentNode, comment, nodeToInsertBefore);
    treeAdapter.insertTextBefore(nodeToInsertBefore.parentNode, '\n', nodeToInsertBefore);
}

function parseOptionalArguments(arg1, arg2) {
    var rootDir;
    [arg1, arg2].forEach(function (arg) {
        if (arg && hasExtension(arg, "json") && fs.lstatSync(arg).isFile()) {
            try {
                const customConfig = JSON.parse(fs.readFileSync(arg, 'utf8'));
                for (var prop in customConfig) {
                    config[prop] = customConfig[prop] || [];
                }
            } catch (e) {
                console.error("Tried to parse config file but got a error. Ignoring. Error: " + e)
            }
        } else if (arg && fs.lstatSync(arg).isDirectory()) {
            rootDir = arg
        }
    })
    return rootDir || config.rootDir;
}

function getElementNameFromImportPath(path) {
    return path.replace(".html", "").replace(/.*\//g, "");
}

function findOldImportsAndCreateImportsNode(d) {
    var importsMap = {};
    var headTag;

    function findAndRemoveImports(doc) {
        var arr = doc.childNodes || [];
        const likeBreaksToRemove = [];
        if (doc.tagName === "head") {
            headTag = doc;
        }
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
            } else if (treeAdapter.isCommentNode(el) && el.data.match(' elements')) {
                tagsToRemove.push(el);
                if (arr[i - 1] && treeAdapter.isTextNode(arr[i - 1]) && arr[i - 1].value.match(/\s/g)) {
                    likeBreaksToRemove.push(arr[i - 1]);
                }
                if (arr[i + 1] && treeAdapter.isTextNode(arr[i + 1]) && arr[i + 1].value.match(/\s/g)) {
                    likeBreaksToRemove.push(arr[i + 1]);
                }
            }
            if (isImport && attrMap["href"]) {
                importsMap[attrMap["href"]] = el.attrs;
                tagsToRemove.push(el);
                if (arr[i + 1] && treeAdapter.isTextNode(arr[i + 1]) && arr[i + 1].value.match(/\s/g)) {
                    likeBreaksToRemove.push(arr[i + 1]);
                }
            }
            if (el.childNodes) {
                findAndRemoveImports(el);
            }
        });
        likeBreaksToRemove.forEach(function(el){
            treeAdapter.detachNode(el);
        });
    }

    findAndRemoveImports(d);

    if (!isFragment) {
        if (tagsToRemove.length) {
            nodeToInsertBefore = tagsToRemove[0];
        } else if (headTag && headTag.childNodes && headTag.childNodes.length) {
            nodeToInsertBefore = headTag.childNodes[0];
        } else if (headTag) {
            nodeToInsertBefore = treeAdapter.createCommentNode('End Imports');
            treeAdapter.appendChild(headTag, nodeToInsertBefore);
        }
    } else {
        nodeToInsertBefore = d.childNodes[0];
    }
    return importsMap;
}

function collectAllWebComponentsTagNames(documentFragment, aggregatorObject) {

    var nodes = documentFragment.childNodes || [];
    var contentNodes = documentFragment.content ? documentFragment.content.childNodes || [] : [];


    nodes.concat(contentNodes).forEach(function (node) {
        var name = node.nodeName;

        if (name.indexOf("dom-") === -1 &&
            name.indexOf("-") !== -1 &&
            config.ignoredComponents.indexOf(name) === -1 && !node.attrs.find(function (attr) {
                return attr.name === "noimport";
            })) {
            checkAttributes(node.attrs, aggregatorObject);
            aggregatorObject[config.resolve[name] || name] = '';
        } else if (name === "style") {
            node.attrs.forEach(function (attr) {
                if ((attr.name === "effects" || attr.name === "include") && attr.value) {
                    var includesArray = attr.value.split(" ");
                    includesArray.forEach(function (includeVal) {
                        aggregatorObject[config.resolve[includeVal] || includeVal] = '';
                    })
                }
            })
        } else{
            node.attrs.forEach(function (attr) {
                if (attr.name === "effects" && attr.value) {
                    var includesArray = attr.value.split(" ");
                    includesArray.forEach(function (includeVal) {
                        aggregatorObject[config.resolve[includeVal] || includeVal] = '';
                    })
                }
            })
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

function findRootDir(filePath, fromConfig) {

    //search for demo folder
    var possibleDemoPath = filePath.replace(new RegExp(separator + "demo" + separator + ".*"), "");
    if (possibleDemoPath !== filePath && fs.readdirSync(possibleDemoPath).indexOf(config.bowerFolderName) !== -1) {
        isDemo = true;
        return fromConfig || possibleDemoPath;
    }
    if (fromConfig) {
        return fromConfig;
    }

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
        if (content.indexOf(".") !== 0 && fs.lstatSync(path).isDirectory() &&
            config.ignoredFolders.indexOf(content) === -1 &&
            (checkBowerComponentsFolder || content !== config.bowerFolderName)) {

            resolveResources(path, nodesObject)

        } else if (hasExtension(content, "html") && nodesObject.hasOwnProperty(getElementNameFromImportPath(content))) {
            var relativePathToRoot = relativePrefix + path.substr(rootDir.length + 1, 999);
            if (isDemo) {
                relativePathToRoot = relativePathToRoot.replace(config.bowerFolderName, "..")
            }
            nodesObject[content.substr(0, content.length - 5)] = relativePathToRoot;
        }
    });
}

function checkAttributes(attrs, aggregatorObject) {
    attrs.forEach(function (attr) {
        //check icons
        if (attr.name == "icon" && attr.value && !isImageUrl(attr.value)) {
            var split = attr.value.split(":")
            if (split.length == 1 || split[0] === "icons") {
                aggregatorObject["iron-icons"] = '';
            } else {
                var name = split[0];
                if (name.indexOf('-') === -1) {
                    name += "-icons"
                }
                aggregatorObject[name] = '';
            }
        } //check animations
        else if (attr.value && config.animationAttributes.indexOf(attr.name) !== -1) {
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
        } else if (importsObject[key]) {
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

function hasExtension(filePath, extension) {
    var extensionWithDot = '.' + extension;
    return filePath.lastIndexOf(extensionWithDot) === filePath.length - extensionWithDot.length
}
