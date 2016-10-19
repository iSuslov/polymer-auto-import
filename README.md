# polymer-auto-import
Script that checks web components used in your .html file and tries to import definitions automatically. All unused imports go under `<!--UNUSED DIRECTLY-->` comment.

<a target="_blank" href="https://www.npmjs.com/package/polymer-auto-import">npm package</a> | <a target="_blank" href="https://github.com/iSuslov/polymer-auto-import">github</a>

## Key features

Searches for usages in:


<b>In `dom-module`</b>
 <li>All web components with names that contain</li>
 <li> Animations in `entry-animation` and `exit-animation` attributes (configurable)</li>
 <li> Icons in all attributes with name `icon`</li>
 <li> All `include` attributes in `style` tags </li>
 <li> All `effects` attributes (configurable) </li>
 
 
<b>In `Polymer({...})` initialization snippet</b>
 <li> Behaviors in `Polymer({behaviors:[...]})` array</li>
 <li> Animations in `animationConfig` property</li>
 
After that it looks for definitions in folders starting from the root project folder and creates relative imports. 
Not tested for component developing.

##Install

``
npm install -g polymer-auto-import
``

##Simple Usage:

Script takes file path as a first argument. Following command

``
 polymer-imports /Users/User/Documents/MyProject/app/src/my-app/app-gallery.html 
``

Will convert this:

```html
<link rel="import" href="../../bower_components/polymerfire/firebase-app.html">

<!--
`app-gallery`


@demo demo/index.html 
-->

<dom-module id="app-gallery">
    <template>
        <style>
            :host {
                display: block;
            }
        </style>
        <paper-button></paper-button>
        <neon-animated-pages entry-animation="slide-down-animation" exit-animation="slide-left-animation">

        </neon-animated-pages>
        <iron-icon icon="vaadin-icons:check"></iron-icon>
        <paper-icon-button icon="menu"></paper-icon-button>
    </template>

    <script>

        Polymer({

            is: 'app-gallery',
            behaviors: [
                Polymer.NeonAnimationRunnerBehavior,
                Polymer.NeonAnimatableBehavior,
            ]
            ,
            properties: {
                animationConfig: {
                    value: function () {
                        return {
                            'entry': [{
                                name: 'slide-down-animation',
                                node: this
                            }, {
                                name: 'fade-in-animation',
                                node: this,
                                timing: {delay: 50}
                            }]
                        }
                    }
                }
            },

        });
    </script>
</dom-module>
```

into this:

```html
<link rel="import" href="../../bower_components/polymer/polymer.html">

<!--Paper elements-->
<link rel="import" href="../../bower_components/paper-button/paper-button.html">
<link rel="import" href="../../bower_components/paper-icon-button/paper-icon-button.html">

<!--Neon elements-->
<link rel="import" href="../../bower_components/neon-animation/animations/slide-down-animation.html">
<link rel="import" href="../../bower_components/neon-animation/animations/slide-left-animation.html">
<link rel="import" href="../../bower_components/neon-animation/neon-animated-pages.html">
<link rel="import" href="../../bower_components/neon-animation/neon-animation-runner-behavior.html">
<link rel="import" href="../../bower_components/neon-animation/neon-animatable-behavior.html">
<link rel="import" href="../../bower_components/neon-animation/animations/fade-in-animation.html">

<!--Vaadin elements-->
<link rel="import" href="../../bower_components/vaadin-icons/vaadin-icons.html">

<!--Iron elements-->
<link rel="import" href="../../bower_components/iron-icon/iron-icon.html" async>
<link rel="import" href="../../bower_components/iron-icons/iron-icons.html">

<!--UNUSED DIRECTLY-->
<link rel="import" href="../../bower_components/polymerfire/firebase-app.html">

<!--
`app-gallery`


@demo demo/index.html 
-->

<dom-module id="app-gallery">
    <template>
        <style>
            :host {
                display: block;
            }
        </style>
        <paper-button></paper-button>
        <neon-animated-pages entry-animation="slide-down-animation" exit-animation="slide-left-animation">

        </neon-animated-pages>
        <iron-icon icon="vaadin-icons:check"></iron-icon>
        <paper-icon-button icon="menu"></paper-icon-button>
    </template>

    <script>

        Polymer({

            is: 'app-gallery',
            behaviors: [
                Polymer.NeonAnimationRunnerBehavior,
                Polymer.NeonAnimatableBehavior,
            ]
            ,
            properties: {
                animationConfig: {
                    value: function () {
                        return {
                            'entry': [{
                                name: 'slide-down-animation',
                                node: this
                            }, {
                                name: 'fade-in-animation',
                                node: this,
                                timing: {delay: 50}
                            }]
                        }
                    }
                }
            },

        });
    </script>
</dom-module>

```

##Options
In most cases you will be fine without additional configuration.

####Additional arguments
`polymer-imports` command requires one mandatory argument - path for a file to inspect for imports. 

You can also path two more arguments (order does not matter):

- Path to the <b>config file</b> which should be `.json` file with configuration
- Path to the <b>root directory</b> of your project. If you passed this path, it is not required to have `polymer.json` in root dir.

####Config file
Config file can be `.json` file with any name and any set of properties from the default configuration, which looks like this:

```
{
    "rootDir": "",
    "bowerFolderName": "bower_components",
    "ignoredFolders": ["test", "demo"],
    "ignoredComponents": [],
    "attributes": [
        "effects",
        "entry-animation",
        "exit-animation"
    ],
    "resolve: {
        "iron-flex": "iron-flex-layout-classes",
        "iron-flex-reverse": "iron-flex-layout-classes",
        "iron-flex-alignment": "iron-flex-layout-classes",
        "iron-flex-factors": "iron-flex-layout-classes",
        "iron-positioning": "iron-flex-layout-classes"
    }
}
```
You can use this default config file as an example for your own. If you define a property in your config it will <b>OVERRIDE</b> the same property in the default configuration. 

####Ignore import
If you don't want an element to be auto imported (you use lazy loading), add `noimport` attribute like this:  `<paper-button noimport></paper-button>`

You can also avoid element to be imported by adding its name to config (if you use config file) to `"ignoredComponents"` property like this `"ignoredComponents": ["paper-button"]`

## Importance of polymer.json file
If you did not provide root directory path of your project as second or third argument or `rootDir` in config file it is important to have polymer.json file in the root directory of your polymer project. This script will search for `polymer.json` file when determining the root of your project.

##Keypoints 

If you have other scripts that run inside `<script>` snippet where `Polymer({})` initialization happens, it is possible that `polymer-auto-import` will fail to check behaviors and animations there.
 For example 
 ```
 <script>
 // this will lead to errors when parsing snippet
 var lib = new Lib();
 
 Polymer({
    is: "my-component"
 });
 
 </script>
 ```
 the solution is to separate `<script>` snippets and have one only for Polymer initialization like this:
  ```
  <script>
    // this is OK
    var lib = new Lib();
  </script>
  
  <script>
  Polymer({
     is: "my-component"
  });
  </script>
  ```

##Requirements:
  - required web components should be installed with `bower` before use
  - node v4 +

##Suggested usage
I recommend to use this script as an `external tool` with your IDE. 

###WebStorm Example
Create a new `external tool`

<img src="https://s14.postimg.org/bjucjn08x/Screen_Shot_2016_10_18_at_01_51_07.png">

Create a new key binding

<img src="https://s10.postimg.org/h6tsa86pl/Screen_Shot_2016_10_16_at_16_14_46.png">

