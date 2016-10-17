# polymer-auto-import
Script that checks web components used in your .html file and tries to import definitions automatically. It will also remove all unused imports. 

##Install

``
npm install polymer-auto-import
``

##Simple Usage:

Following command

``
 node polymer-imports.js /Users/User/Documents/MyProject/app/src/my-app/my-app.html 
``

Will convert this:

```html
<dom-module id="my-app">
    <template>
        <style>
            :host {
                display: block;
            }
        </style>
        <firebase-app>
        </firebase-app>

        <paper-drawer-panel>
        </paper-drawer-panel>
    </template>

    <script>
        Polymer({
            is: 'mt-app',
        });
    </script>
</dom-module>
```

into this:

```html
<link rel="import" href="../../bower_components/polymer/polymer.html">

<!--Firebase elements-->
<link rel="import" href="../../bower_components/polymerfire/firebase-app.html">

<!--Paper elements-->
<link rel="import" href="../../bower_components/paper-drawer-panel/paper-drawer-panel.html">
<dom-module id="my-app">
    <template>
        <style>
            :host {
                display: block;
            }
        </style>
        <firebase-app>
        </firebase-app>

        <paper-drawer-panel>
        </paper-drawer-panel>
    </template>

    <script>
        Polymer({
            is: 'mt-app',
        });
    </script>
</dom-module>
```

##Options
If you don't want an element to be auto imported, add `noimport` attribute like this:  `<paper-button noimport></paper-button>`

## Importance of polymer.json file
It is important to have polymer.json file in the root directory of your polymer project. This script searches for `polymer.json` file when determining the root of your project.

##Keypoints 

If you have other scripts that run inside `<script>` snippet where `Polymer({})` initialization happens, it is possible that `polymer-auto-import` will fail to check behaviours and animations there.
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

<img src="https://s16.postimg.org/v6dotbxs5/Screen_Shot_2016_10_16_at_16_33_37.png">

Create a new key binding

<img src="https://s10.postimg.org/h6tsa86pl/Screen_Shot_2016_10_16_at_16_14_46.png">

