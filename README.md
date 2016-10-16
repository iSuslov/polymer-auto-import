# polymer-auto-import
Script that checks web components used in your .html file and tries to import definitions automatically 

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

##Requirements:
  - required web components should be installed with `bower` before use
  - node

##Suggested usage
I recommend use this script as an `external tool` with your IDE. 