/**
 * Custom jquery plugin for binding elements title attribute to display in a specified zone.
 * Usage minimum: $(".someclass").helpzone();
 *
 * This will make by default each element's title attribute be the content displayed in a new block element appended to the body
 * on focus.
 * Typically, we want to specify a specific element for the helpzone to be displayed.
 * 2 ways are supported:
 *  - from zones options: $(".someclass").helpzone({ zones: $(".helpzone") });
 *  - from html5 data attributes: <div class="someclass" data-helpzone-zones-refs=".helpzone" />
 *    The content of the data-helpzone-refs is a selector, the same way it would appear if usd from zones options.
 * If both methods are used for the same object, the zones options take precedence.
 *
 * The plugin support multiple helpzones bound to the same element:
 *  - from zones options: $(".someclass").helpzone({ zones: $(".helpzone1, .helpzone2") })
 *          (optionally an array can be used instead: { zones: [$(".helpzone1"), $(".helpzone2)] }
 *  - from html5 data attributes: <div class"=someclass" data-helpzone-zones-refs=".helpzone1, .helpzone2" />
 *
 * It is also possible for an element to reference the title attribute of another element to avoid duplication:
 *  <div class="elt1" title="I am some content to display"></div>
 *  <div class="elt2" data-helpzone-title-ref=".elt1"></div>
 *
 * The plugin can be customized with various options, including:
 *  - event: which event trigger the display to the helpzone (default: focus)
 *  - suppress: wether to remove the title attributes as title attributes are always shown on hover by the browser (default: true)
 *  - afterShow: callback functions when the new content has been shown.
 *	    Context is the current source element and the targetZone is passed as param 
 *  - content: function to call to get the new content to display.
 *          Context is the current source element.
 *          (default: get the title attribute content of the source or specified in data-helpzone-title-ref)
 *  - beforeUpdate: callback function called before the new content is displayed.
 *          The display can be canceled by returning false.
 *          Params passed are the helpZone target, the newContent as string and manualUpdate boolean telling if the update
 *          was manual via a call to method "update" or automatic after an event.
 *
 * Event:
 * The custom jquery event "helpzonebeforeupdate" is also triggered when about to display the new content.
 * As with beforeUpdate callback, the display can be prevented by calling .preventDefault(). The params are the same
 * as for beforeUpdate callback, this is just an alternative way to do the same thing.
 *
 * @author Lanoux Fabien
 */

(function (factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define([
            "jquery"
        ], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = factory(require("jquery"));
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    // singleton pattern for jquery plugin best practice
    function HelpZone() {
        this.defaults = {
            zones: $("<div/>"), // target jquery collection where to display the data content (support multiple zones)
            event: 'focus', // on which event we want to display the data content
            suppress: true, // boolean to tell if we want to remove title attribute or not
	        afterShow: null, // callback when new content has been shown
            content: function () { // function that get the content to display
                var refSelector;
                var getTitleContent = function ($elt) {
                    var title = $elt.attr("oldtitle"); // oldtitle contains original title attribute
                    if (typeof title === 'undefined') { // in case suppress option is false
                        title = $elt.attr("title");
                    }
                    return title;
                };

                var title = getTitleContent($(this));

                if (typeof title === 'undefined') { // no title? use data-fab-helpzoneRef insead
                    refSelector = $(this).data(plugin.dataTitleRef);
                    title = getTitleContent($(refSelector));
                }

                return title;
            },
            beforeUpdate: null // callback to call before target zones are updated. Cancel update if returns false
                               // (do not trigger helpzonebeforeupdate event)
                               // Params object:
                               // { targetHelpzones: the jquery helpzone collection,
                               // newContent: string the new content,
                               // manualUpdate: boolean - see doc}
        };
    }


    // par conventions, on utilise '_' pour dire qu'une fonction ne doit jamais être evoquées directement par le user mais en interne par notre plugin
    // markerClassName & propertyName sont des noms souvent rencontrés dans les plugins jQuery
    $.extend(HelpZone.prototype, {
        markerClassNameSource: 'fab-hasSourceHelpZone', // tag source element as being attached to plugin
        propertyName: 'fab-helpzone-source', // data attribute où on pourra retrouver l'instance de notre plugin
        markerClassNameTarget: 'fab-hasTargetHelpZone', // mark helpzone as being associated with source
        dataTitleRef: 'helpzone-title-ref', // data attribute with selector pointing to other element whose title must be used
        marckerClassNameNotInDOM: 'fab-wasNotInDOM', // if no zones were specified at all, mark the default created zones
        dataZonesRef: 'helpzone-zones-ref', // data attribute with selector pointing to one or several zones

        // on définit une méthode pour setter global default options (remplacer nos default options pour tout le monde)
        // On l'évoque alors avant d'initializer le plugin pour un element via: $.helpzone.setDefaults({zone: ...., event: ....})
        setDefaults: function (options) {
            $.extend(this.defaults, options || {});
            return this;
        },

        // attach the plugin instance to the data of the source element
        // in this function goes all common code that does not depend on any custom option
        _attachPlugin: function (source, options) {
            var htmlDataZonesRef;

            source = $(source);

            if (source.hasClass(this.markerClassNameSource)) { // already initialized: don't reinitialize plugin
                return;
            }

            options.zones = options.zones || this._getZonesFromHtmlDataAttributes(source) || this.defaults.zones;

            var inst = {
                options: $.extend({}, this.defaults),
                initialContent: options.zones.map(function () {
                    return $(this).html()
                }) // keep initial content to restore it if needed
            };
            source.addClass(this.markerClassNameSource)
                .data(this.propertyName, inst); // jquery plugin way of storing the custom plugin instance

            this._optionPlugin(source, options);
        },

        /**
         * Returns jquery collection of the zones referenced in the element's data attributes
         * @param source the source element
         * @returns {*|jQuery|HTMLElement}
         * @private
         */
        _getZonesFromHtmlDataAttributes: function (source) {
            var htmlDataZonesRefSelectors = source.data(this.dataZonesRef);
            var htmlDataZoneRefs = $(htmlDataZonesRefSelectors);

            if (htmlDataZonesRefSelectors && !htmlDataZoneRefs.length) { // can't find what the selector tells us ?
                throw "HTML Data Helpzone reference: '" + htmlDataZonesRefSelectors + "' not found";
            }
            return htmlDataZoneRefs;
        },

        /**
         * Retrieve or reconfigure the settings for a control.
         * @param {element} source the element target to affect
         * @param {object} options the new options for this instance of {String} an individual property value
         * @param {any} value the individual property value (omit if options is an object or to retrive the value of a setting)
         * @returns {any} if retrieving a value
         */
        _optionPlugin: function (source, options, value) {
            /* start of boilerplate code common to most jquery plugins */
            source = $(source);
            var inst = source.data(this.propertyName);
            if (!options || (typeof options == 'string' && value == null)) { // Get option
                var name = options;
                options = (inst || {}).options;
                return (options && name ? options[name] : options);
            }
            if (!source.hasClass(this.markerClassNameSource)) { // check plugin has been initialized
                return;
            }
            options = options || {};
            if (typeof options === 'string') { // set single named option
                var name = options;
                options = {};
                options[name] = value;
            }
            /* end of boilerplate code */
            if (options.zones) {
                options.zones = $.isArray(options.zones) ? this._convertArrayToCollection(options.zones) : options.zones;
                this._resetHelpzonesDefaults(source, inst);

                // format the new one
                options.zones.addClass(this.markerClassNameTarget);
            }

            source.off(inst.options.event + '.' + this.propertyName);

            $.extend(inst.options, options); // update with new options

            // from now on options have been merged
            options.zones = null; // reset options.zones for next loop if called comes from jquery collection

            // bind option event to helpzone update
            source.on(inst.options.event + '.' + this.propertyName, function () {
                inst.options.zones.each(function () {
                    plugin._beforeUpdateHelpZoneContent(source, inst, $(this));
                })
            });

            // store but remove title attribute because we don't want to see it on hover
            if (inst.options.suppress && source[0].title) {
                this._switchAttribute(source[0], "title", "oldtitle");
            }

            // for every non-existing zone in the DOM, append default zone to body
            inst.options.zones.each(function () {
                var zone = $(this);
                if (!zone.length) { // if zone not in DOM, append to end of body
                    $('body').append(zone).addClass(plugin.marckerClassNameNotInDOM);
                }
            });
        },

        /**
         * Convert an array of jquery objects to a jquery collection
         * @param array - the array to convert
         * @returns {jQuery Collection}
         */
        _convertArrayToCollection: function (array) {
            return $(array).map($.fn.toArray);
        },

        /**
         * Update content into the target zone.

         * @param {jQuery} source the jquery source element
         * @param {Object} inst the plugin instance
         * @param {String} content the html content as string to set in the target zone
         */
        _updateHelpZoneContent: function (source, inst, targetZone, content) {
            targetZone.html(content).val(content);
            (inst.options.afterShow || $.noop).call(source[0], targetZone[0]);
        },


        /**
         * Put oldName attribute content into newName attribute and remove oldName attribute
         * @param {element} source the element onto which perform the switch
         * @param {String} oldName the attribute to be replaced with newName
         * @param {String} newName the attribute to replace oldName with
         */
        _switchAttribute: function (source, oldName, newName) {
            source = $(source);
            source.attr(newName, source.attr(oldName)).removeAttr(oldName);
        },

        /**
         * Update content immediately from custom content if present or from calling the content callback otherwise.
         * Also calls beforeUpdate() and triggers helpzonebeforeupdate custom Event.
         * @param {element} source the source element the helpzone refers to
         * @param {String} (Optional) content string (defaults to calling instance content function if absent)
         */
        _updatePlugin: function (source, content) {
            source = $(source);

            if (!source.hasClass(this.markerClassNameSource)) {
                return;
            }
            var inst = source.data(this.propertyName);

            inst.options.zones.each(function () {
                plugin._beforeUpdateHelpZoneContent(source, inst, $(this) , content, true);
            });
        },


        /**
         * Call beforeUpdate callback and trigger beforeUpdateEvent before actual update
         * if not canceled.
         * @param {jQuery} source the jquery source element
         * @param {Object} inst the plugin instance
         * @param {jQuery} targetZone the helpzone to update
         * @param {String} (optional) content the html content as string to set in the target zone.
         *                 Defaults to calling instance content function if absent.
         * @param {Boolean} (optional) manualUpdate wether the update is done from manual update call (true) or from options.event
         *                 (false) (default: false)
         * @private
         */
        _beforeUpdateHelpZoneContent: function (source, inst, targetZone, content, manualUpdate) {
            var eventParams = { // object passed as params of custom event
                targetZone: targetZone[0],
                newContent: content || inst.options.content.call(source[0], targetZone[0]),
                manualUpdate: manualUpdate || false
            };

            var beforeUpdateEvent = $.Event("helpzonebeforeupdate");

            beforeUpdateEvent.target = source[0]; // set target event so delegated event can work
            if ($.isFunction(inst.options.beforeUpdate)) { // call custom event handler before update
                if (inst.options.beforeUpdate.call(source[0], eventParams) === false) { //cancel if returns false
                    return;
                }
            }

            source.trigger(beforeUpdateEvent, [eventParams]); // trigger our custom event before update
            if (!beforeUpdateEvent.isDefaultPrevented()) { // if not prevented
                plugin._updateHelpZoneContent(source, inst, targetZone, eventParams.newContent);
            }
        },


        /**
         * Get all help zones only in use by the source passed in argument
         * @param {element} source the source reference targetting the shared zone
         * @param {Object} inst the source instance plugin
         * @return {jQuery} a collection of 0 or more help zones that are not shared with any other source sources
        */
        _getHelpzonesOnlyUsedBySource: function (source, inst) {
            source = $(source);
            var thisSourceZones = inst.options.zones;
            var differentSourceZones = $();

            $("." + this.markerClassNameSource).not(source).filter(function () {
                var candidateSourceZonesArray = $(this).data(plugin.propertyName).options.zones.toArray();

                differentSourceZones.add(thisSourceZones.filter(function (index) {
                    return candidateSourceZonesArray.indexOf(thisSourceZones[index]) === -1;
                }));

            });

            return differentSourceZones.length ? differentSourceZones : thisSourceZones;
        },

        /**
         * Considering the source in argument, look for each of its associated zones and restore original
         * if any of them is not used by another source source
         * @param source the source element
         * @param inst the instance plugin
         */
        _resetHelpzonesDefaults: function (source, inst) {
            // restore to initial state
            this._getHelpzonesOnlyUsedBySource(source[0], inst)
                .remove(this.marckerClassNameNotInDOM)
                .removeClass(this.markerClassNameTarget)
                .each(function (i) {
                    $(this).html(inst.initialContent[i]);
                });
        },


        /**
         * Get the content to be added to the helpzone
         * @param {element} source the source element we want the content from
         * @returns {Object} with properties "zone" the targeted zone and "content" the content
         */
        _contentPlugin: function (source) {
            source = $(source);

            if (!source.hasClass(this.markerClassNameSource)) {
                return;
            }
            var inst = source.data(this.propertyName);
            return inst.options.zones.map(function () {
                return {
                    zone: this,
                    content: inst.options.content.call(source[0], this)
                };
            });
        },

        /**
         * Remove the plugin attached to the source element to restore it to its initial state before applying the plugin
         * @param {element} source the source element to remove the plugin from
         */
        _destroyPlugin: function (source) {
            source = $(source);

            if (!source.hasClass(this.markerClassNameSource)) {
                return;
            }
            var inst = source.data(this.propertyName);

            this._resetHelpzonesDefaults(source, inst);

            source.removeClass(this.markerClassNameSource);
            source.removeData(this.propertyName);
            source.off(inst.options.event + '.' + this.propertyName);

            if (inst.options.suppress && source[0].title) {
                this._switchAttribute(source[0], "oldtitle", "title");
            }

            $('.' + this.marckerClassNameNotInDOM).remove(); // delete all created automatically created helpzones
        }
    });

    // instanciate our singleton and save it the external plugin so we can reference it anywhere
    var plugin = $.helpzone = new HelpZone();

    // $.fn est en fait un alias pour $.prototype.
    // On définit un "collection plugin" dans le sens où on voudra l'appeler sur une collection de jquery object ex: $('.selector').helpzone()
    // Quand on utilise $.fn, jQuery nous passe dans le 'this' la collection des dom jquery objects, il ne faut donc pas utilier $(this)!

    /**
     * Attach the help zone functionality to a jQuery selection
     * @param {Object} options the new sttings to use for these instances (optionale)
     * @returns {jquery} for chaining further calls
     */
    $.fn.helpzone = function (options) {
        var otherArgs = Array.prototype.slice.call(arguments, 1); // extract secondary parameters
        return this.each(function () {
            if (typeof options == 'string') { // if method call aka $('.selector').helpzone('somemethod');
                if (!plugin['_' + options + 'Plugin']) { // check that method exists
                    throw 'Unkown method: ' + options;
                }
                plugin['_' + options + 'Plugin'].apply(plugin, [this].concat(otherArgs)); // invoke the method
            } else { // no arguments ? alors initialization
                plugin._attachPlugin(this, options || {}); // this est alors ici le current jquery element de la collection
            }
        });
    }

    // make defaults publicly accessible
    $.fn.helpzone.defaults = plugin.defaults;
}));
