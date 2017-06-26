define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "jquery",
    "./lib/ckeditor_viewer",
    "dojo/text!CKEditorForMendix/widget/templates/CKEditorViewerForMendix.html",
    "./lib/highlight.pack",

    "./lib/dotdot.jquery",
], function (declare, _WidgetBase, _TemplatedMixin, domStyle, dojoArray, lang, text, _jQuery, _CKEditorViewer, widgetTemplate, hljs) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    return declare("CKEditorForMendix.widget.CKEditorViewerForMendix", [_WidgetBase, _TemplatedMixin], {

        // Template path
        templateString: widgetTemplate,

        _contextObj: null,
        _handles: null,
        cutOffRules: null,

        update: function (obj, callback) {
            //logger.level(logger.DEBUG);
            logger.debug(this.id + ".update");

            this._contextObj = obj;

            if (obj && typeof obj.metaData === "undefined") {
                logger.warn(this.id + ".update Error: CKeditorViewer was configured for an entity the current user has no access to.");
                this._executeCallback(callback, "update");
            } else {
                this._resetSubscriptions();
                this._updateRendering(callback);
            }
        },

        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");
            if(this._contextObj) {

                domStyle.set(this.domNode, "display", "inline");
                var html = this._contextObj.get(this.messageString),
                    name = Date.now ? Date.now() : +new Date();

                if (!html) {
                  html = "";
                }

                // Set the content of the link.
                window.CKEditorViewer.data[this.id] = {};
                window.CKEditorViewer.data[this.id].microflowLinks = this.microflowLinks;

                // Replace the html with the constant variables.
                html = html.split("__LINK__").join("#" + name + "\" name=\"" + name + "\"");
                html = html.split("__ID__").join(window.CKEditorViewer.base64.encode(this.id));
                html = html.split("__GUID__").join(window.CKEditorViewer.base64.encode(this._contextObj.getGuid()));

                html = html.replace(/(<img.*src=\")(file\?guid=)(\d+)(\".* \/>)/g, lang.hitch(this, this._replaceUrl));

                $(this.domNode).html("");
                $(this.domNode).append(html);

                $(this.domNode).find("pre code").each(function(i, block) {
                  hljs.highlightBlock(block);
                });

                if (this.cutOffRules !== null && this.cutOffRules > 0) {
                    $(this.domNode).dotdotdot({
                        height: this.cutOffRules,
                        wrap: "letter",
                        watch: true
                    });
                }

                this.microflowButtonsPreventDefault();
            }
            else {
                domStyle.set(this.domNode, "display", "none");
            }

            this._executeCallback(callback, "_updateRendering");
        },

        microflowButtonsPreventDefault: function () {
            logger.debug(this.id + ".microflowButtonsPreventDefault");

            // Make sure only the onclick exec function is called
            $("a.mx-microflow-link", this.domNode).each(function () {
                $(this).on("click", function (e) {
                    e.preventDefault();
                });
            });
        },

        _replaceUrl: function (match, p1, p2, p3, p4, offset, string) {
            // We will replace group 2 and 3 with an url created based on group 3
            // See https://regexper.com/#%2F(%3Cimg.*src%3D%5C%22)(file%5C%3Fguid%3D)(%5Cd%2B)(%5C%22.*%20%5C%2F%3E)%2F
            return p1 + this._getFileUrl(p3) + p4;
        },

        _getFileUrl: function (guid) {
            var changedDate = Math.floor(Date.now() / 1); // Right now;
            if (mx.data.getDocumentUrl) {
                return mx.data.getDocumentUrl(guid, changedDate, false);
            }
            return mx.appUrl + "file?" + [
                "guid=" + guid,
                "changedDate=" + changedDate
            ].join("&");
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            var objHandle = null,
                attrHandle = null;

            // Release handles on previous object, if any.
            if(this._handles){
                dojoArray.forEach(this._handles, lang.hitch(this, function (handle) {
                    this.unsubscribe(handle);
                }));
            }

            if (this._contextObj) {
                objHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: lang.hitch(this,function(guid) {
                        this._updateRendering();
                    })
                });

                attrHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.messageString,
                    callback: lang.hitch(this,function(guid,attr,attrValue) {
                        this._updateRendering();
                    })
                });

                this._handles = [objHandle, attrHandle];
            }
        },

        _executeCallback: function (cb, from) {
            logger.debug(this.id + "._executeCallback " + (typeof cb) + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        }

    });
});
