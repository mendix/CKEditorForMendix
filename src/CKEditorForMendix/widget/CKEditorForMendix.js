/*global logger */

define([
        "dojo/_base/declare",
        "mxui/widget/_WidgetBase",
        "dijit/_TemplatedMixin",
        "mxui/dom",
        "dojo/dom-style",
        "dojo/dom-class",
        "dojo/dom-construct",
        "dojo/_base/array",
        "dojo/_base/lang",
        "dojo/text",
        "CKEditorForMendix/widget/lib/jquery-1.11.1",
        "CKEditorForMendix/widget/lib/ckeditor",
        "dojo/text!CKEditorForMendix/widget/templates/CKEditorForMendix.html"
    ], function (declare, _WidgetBase, _TemplatedMixin, dom, domStyle, dojoClass, domConstruct, dojoArray, lang, text, _jQuery, _CKEditor, widgetTemplate) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    return declare("CKEditorForMendix.widget.CKEditorForMendix", [_WidgetBase, _TemplatedMixin], {
        _contextGuid: null,
        _contextObj: null,
        _handles: null,
        _alertdiv: null,
        _hasStarted : false,
        _isReadOnly: false,

        _focus: false,

        // Extra variables
        _extraContentDiv: null,
        _editor: null,
        _timer: null,

        // CKEditor instances.
        _settings: null,

        templateString: widgetTemplate,

        postCreate: function () {
            //logger.level(logger.DEBUG);
            logger.debug(this.id + ".postCreate");
            if( this.showLabel ) {
                if (dojoClass.contains(this.ckEditorLabel, "hidden")) {
                    dojoClass.remove(this.ckEditorLabel, "hidden");
                }
                this.ckEditorLabel.innerHTML = this.fieldCaption;
            } else {
                if (!dojoClass.contains(this.ckEditorLabel, "hidden")) {
                    dojoClass.add(this.ckEditorLabel, "hidden");
                }
            }

            if (this.readOnly || this.get("disabled") || this.readonly) {
                this._isReadOnly = true;
            }
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
            this._resetSubscriptions();
            this._updateRendering(lang.hitch(this, function () {
                this.mxform.resize();
                callback();
            }));
        },

        _setupEvents: function () {
            logger.debug(this.id + "._setupEvents");
            // On change event (== on keypress)
            this._editor.on("change", lang.hitch(this, function () {
                this._editorChange(this._editor.getData());

                if (this.onKeyPressMicroflow) {
                    mx.data.action({
                        params: {
                            applyto: "selection",
                            actionname: this.onKeyPressMicroflow,
                            guids: [this._contextObj.getGuid()]
                        },
                        store: {
                            caller: this.mxform
                        },
                        callback: function (obj) {
                        },
                        error: function (error) {
                            console.log(this.id + ": An error occurred while executing microflow: " + error.description);
                        }
                    }, this);
                }
            }));

            this._editor.on("focus", lang.hitch(this, function (e) {
                this._focus = true;
            }));

            //On blur (unselecting the textbox) event
            this._editor.on("blur", lang.hitch(this, function (e) {
                this._focus = false;
                if (this._editor.checkDirty() && this.onChangeMicroflow) {
                    mx.data.action({
                        params: {
                            applyto: "selection",
                            actionname: this.onChangeMicroflow,
                            guids: [this._contextObj.getGuid()]
                        },
                        callback: lang.hitch(this, function (obj) {
                            this._editor.resetDirty();
                        }),
                        error: lang.hitch(this, function (error) {
                            console.log(this.id + ": An error occurred while executing microflow: " + error.description);
                        })
                    }, this);
                }

            }));
        },

        _editorChange: function (data) {
            logger.debug(this.id + "._editorChange:", data);
            if (this._contextObj !== null) {
                this._contextObj.set(this.messageString, data);
            }
        },

        // Create child nodes.
        _createChildNodes: function () {
            logger.debug(this.id + "._createChildNodes");
            this.domNode.appendChild(dom.create("textarea", {
                "name": "html_editor_" + this.id,
                "id": "html_editor_" + this.id,
                "rows": "10",
                "cols": "80"
            }));

            var seperator1 = null,
                seperator2 = null;

            //console.debug("ckeditorformendix - BASEPATH - " + window.CKEDITOR_BASEPATH);

            // Create new config
            this._settings = [];
            this._settings[this.id] = {
                config: {
                    toolbarGroups: []
                }
            };

            this._CKEditor = window.CKEDITOR;

            // Collapsable toolbar
            this._settings[this.id].config.toolbarCanCollapse = true;

            // Autogrow functionality of the editor.
            this._settings[this.id].config.autoGrow_minHeight = 300;
            this._settings[this.id].config.autoGrow_onStartup = true;
            if (this.width > 0) {
                this._settings[this.id].config.width = this.width;
            }
            if (this.height > 0) {
                this._settings[this.id].config.height = this.height;
            }


            // Base URL inside CKEditor
            this._settings[this.id].config.baseHref = mx.appUrl;

            // CSS class
            if (this.bodyCssClass !== "") {
                this._settings[this.id].config.bodyClass = this.bodyCssClass;
            }

            seperator1 = false;
            seperator2 = false;

            this._CKEditor.config.toolbarGroups = [];

            if (this.toolbarDocument) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "document",
                    groups: ["mode", "document", "doctools"]
                });
                seperator1 = true;
            }
            if (this.toolbarClipboard) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "clipboard",
                    groups: ["clipboard", "undo"]
                });
                seperator1 = true;
            }
            if (this.toolbarEditing) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "editing",
                    groups: ["find", "selection", "spellchecker"]
                });
                seperator1 = true;
            }
            if (this.toolbarForms) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "forms"
                });
                seperator1 = true;
            }

            if (this.toolbarSeperator1) {
                this._settings[this.id].config.toolbarGroups.push("/");
            }

            if (this.toolbarBasicstyles) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "basicstyles",
                    groups: ["basicstyles", "cleanup"]
                });
                seperator2 = true;
            }
            if (this.toolbarParagraph) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "paragraph",
                    groups: ["list", "indent", "blocks", "align", "bidi"]
                });
                seperator2 = true;
            }
            if (this.toolbarLinks) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "links"
                });
                seperator2 = true;
            }
            if (this.toolbarInsert) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "insert"
                });
                seperator2 = true;
            }

            if (this.toolbarSeperator2) {
                this._settings[this.id].config.toolbarGroups.push("/");
            }

            if (this.toolbarStyles) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "styles"
                });
            }
            if (this.toolbarColors) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "colors"
                });
            }
            if (this.toolbarTools) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "tools"
                });
            }
            if (this.toolbarOthers) {
                this._settings[this.id].config.toolbarGroups.push({
                    name: "others"
                });
            }

            // Create a CKEditor from HTML element.
            this._editor = this._CKEditor.replace("html_editor_" + this.id, this._settings[this.id].config);

            // Set enterMode
            this._editor.config.enterMode = this._CKEditor["ENTER_" + this.enterMode];
            this._editor.config.shiftEnterMode = this._CKEditor["ENTER_" + this.shiftEnterMode];

            // Set autoparagraph
            this._editor.config.autoParagraph  = this.autoParagraph;

            // Attach Mendix Widget to editor and pass the mendix widget configuration to the CKEditor.
            this._editor.mendixWidget = this;
            this._editor.mendixWidgetID = this.id;
            this._editor.mendixWidgetConfig = {
                microflowLinks: this.microflowLinks
            };

            // in case of data not loaded into editor, because editor was not ready
            this._updateRendering();

            //console.debug("ckeditorformendix - createChildNodes events");
        },

        _handleValidation: function (validations) {
            logger.debug(this.id + "._handleValidation");
            this._clearValidations();

            var val = validations[0],
                msg = val.getReasonByAttribute(this.messageString);

            if (this.readOnly) {
                val.removeAttribute(this.messageString);
            } else {
                if (msg) {
                    this._addValidation(msg);
                    val.removeAttribute(this.messageString);
                }
            }
        },

        _clearValidations: function () {
            logger.debug(this.id + "._clearValidations");
            domConstruct.destroy(this._alertdiv);
        },

        _addValidation: function (msg) {
            logger.debug(this.id + "._addValidation");
            this._alertdiv = domConstruct.create("div", {
                "class": "alert alert-danger",
                innerHTML: msg
            });

            this.domNode.appendChild(this._alertdiv);
        },

        _updateAttrRendering: function () {
            if (!this._focus) {
                this._updateRendering();
            }
        },

        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");

            if (!this._editor && !this._isReadOnly) {
                this._createChildNodes();
                this._setupEvents();
            }

            if (this._contextObj) {
                //console.debug(this._contextObj.get(this.messageString));

                domStyle.set(this.domNode, "visibility", "visible");

                if (this._editor !== null) {
                    this._editor.setData(this._contextObj.get(this.messageString));
                } else {
                    logger.warn(this.id + " - Unable to add contents to editor, no _editor object available");
                }
            } else {
                domStyle.set(this.domNode, "visibility", "hidden");
            }

            if (callback && typeof callback === "function") {
                logger.debug(this.id + "._updateRendering.callback");
                callback();
            }
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            var objHandle = null,
                attrHandle = null,
                validationHandle = null;

            // Release handles on previous object, if any.
            if (this._handles) {
                dojoArray.forEach(this._handles, function (handle) {
                    mx.data.unsubscribe(handle);
                });
            }

            if (this._contextObj) {
                objHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: lang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });

                attrHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.messageString,
                    callback: lang.hitch(this,function(guid,attr,attrValue) {
                        this._updateAttrRendering();
                    })
                });

                validationHandle = mx.data.subscribe({
                    guid: this._contextObj.getGuid(),
                    val: true,
                    callback: lang.hitch(this, this._handleValidation)
                });

                this._handles = [objHandle, attrHandle, validationHandle];
            }
        },

        uninitialize: function () {
            logger.debug(this.id + ".uninitialize");
            if (this._editor) {
                this._editor.removeAllListeners();
                this._editor.destroy();
            }
        }
    });
});
