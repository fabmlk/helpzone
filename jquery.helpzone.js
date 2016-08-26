/**
 * Custom jquery plugin for binding inputs title attribute to display in a specified zone.
 * Usage minimum: $("input[type='text']").helpzone({zones: $("#helpzone"));
 *
 * This will make by default each input's title attribute be the content displayed in $("#helpzone") on focus
 * It can be customized with various options, including:
 *  - event: which event trigger the display to the helpzone (default: focus)
 *  - suppress: wether to remove the title attributes as title attributes are always shown on hover by the browser (default: true)
 *  - show/hide: callback functions when the old content is hidden and new content shown.
 *          Context is the current input element and the targetZone is passed as param.
 *          Supports animations by using .promise() internally.
 *          (default: null)
 *  - afterShow/afterHide: callback functions when the old content has been hidden and new content shown.
 *	    Context is the current input element and the targetZone is passed as param 
 *  - content: function to call to get the new content to display.
 *          Context is the current input element.
 *          (default: get the title attribute content of the input)
 *  - beforeUpdate: callback function called before the new content is displayed.
 *          The display can be canceled by returning false.
 *          Params passed are the helpZone target and the newContent as string.
 *
 * Event:
 * The custom jquery event "helpzonebeforeupdate" is also triggered when about to display the new content.
 * As with beforeUpdate callback, the display can be prevented by calling .preventDefault().
 *
 * NEW: can now accept a jquery collection to update multiple zones at the same time:
 *      $("input[type='text']").helpzone({zones: $("#leftZone, #rightZone")});
 *
 * This will update both #leftZone & #rightZone with the same content. For now, it is impossible to
 * have different content for different helpzones => TODO
 *
 * @author Lanoux Fabien
 */

(function( factory ) {
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define([
			"jquery"
		], factory );
	} else if(typeof module === 'object' && module.exports) {
		// Node/CommonJS
		module.exports = factory(require("jquery"));
	} else {
		// Browser globals
		factory( jQuery );
	}
}(function( $ ) {
    
    // singleton pattern for jquery plugin best practice
    function HelpZone () {
        this._defaults = {
            zones: $("<div/>"), // target jquery collection where to display the data content (support multiple zones)
            event: 'focus', // on which event we want to display the data content
            suppress: true, // boolean to tell if we want to remove title attribute or not
            show: null, // callback when new content is being shown
            hide: null, // callback when old content is being hidden
	        afterShow: null, // callback when new content has been shown
	        afterHide: null, // callback when old content has been hidden
            content: function () { // function that get the content to display
                var title = $(this).attr("oldtitle"); // oldtitle contains original title attribute
                if (typeof title === 'undefined') { // in case suprress option is false
                    title = $(this).attr("title");
                }
                return title;
            },
            beforeUpdate: null // callback to call before target zones are updated. Cancel update if returns false (do not trigger helpzonebeforeupdate event)
                // Params object: { helpzoneTarget: the jquery helpzone element, newContent: string the new content }
        };
    }

    
    // par conventions, on utilise '_' pour dire qu'une fonction ne doit jamais être evoquées directement par le user mais en interne par notre plugin
    // markerClassName & propertyName sont des noms souvent rencontrés dans les plugins jQuery
    $.extend(HelpZone.prototype, {
        markerClassNameSource: 'fab-hasSourceHelpZone', // tag l'input comme etant attaché au plugin
        propertyName: 'fab-helpzone-source', // data attribute où on pourra retrouver l'instance de notre plugin
        markerClassNameTarget: 'fab-hasTargetHelpZone',
        markerClassNameWrapper: 'fab-helpzone-wrapper',
        
        // on définit une méthode pour setter global default options (remplacer nos default options pour tout le monde)
        // On l'évoque alors avant d'initializer le plugin pour un element via: $.helpzone.setDefaults({zone: ...., event: ....})
        setDefaults: function (options) {
            $.extend(this._defaults, options || {});
            return this;
        },
        
        // attach the plugin instance to the data of the input
        // in this function goes all common code that does not depend on any custom option
        _attachPlugin: function (input, options) {
            input = $(input);
            
            if (input.hasClass(this.markerClassNameSource)) { // already initialized: don't reinitialize plugin
                return;
            }
            var inst = {
                options: $.extend({}, this._defaults),
                initialContent: (options.zones || this._defaults.zones).map(function () {
                    return $(this).html()
                }) // keep initial content to restore it if needed
            };
            input.addClass(this.markerClassNameSource)
                    .data(this.propertyName, inst); // jquery plugin way of storing the custom plugin instance

            this._optionPlugin(input, options);
        },
        
        /**
         * Retrieve or reconfigure the settings for a control.
         * @param {element} input the element target to affect
         * @param {object} options the new options for this instance of {String} an individual property value
         * @param {any} value the individual property value (omit if options is an object or to retrive the value of a setting)
         * @returns {any} if retrieving a value
         */
        _optionPlugin: function (input, options, value) {
            /* start of boilerplate code common to most jquery plugins */
            input = $(input);
            var inst = input.data(this.propertyName);
            if (!options || (typeof options == 'string' && value == null)) { // Get option
                var name = options;
                options = (inst || {}).options;
                return (options && name ? options[name] : options);
            }
            if (!input.hasClass(this.markerClassNameSource)) { // check plugin has been initialized
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
                this._resetHelpzonesDefaults(input, inst);

                // format the new one
                options.zones.addClass(this.markerClassNameTarget);
                $.each(options.zones, function (i, zone) {
                    var zone = $(zone);
                    if (zone.children("." + this.markerClassNameWrapper).length === 0) {
                        // we add a wrapper inside the helpzone. This will be also very usefull when we allow the user
                        // to add custom show/hide callbacks for animation
                        zone.children().length ? // if has children, wrap with wrapper
                            zone.children().wrapAll("<div class='" + plugin.markerClassNameWrapper + "'>")
                            // else simply append wrapper
                            : zone.append("<div class='" + plugin.markerClassNameWrapper + "'>");
                    }
                });
            }
            
            input.off(inst.options.event + '.' + this.propertyName);
            
            $.extend(inst.options, options); // update with new options 
            
            // from now on options have been merged
            input.on(inst.options.event + '.' + this.propertyName, function () {
                var eventParams = { // object passed as params of custom event
                    // WARNING: use find() instead of children() as if jquery ui effects are running, a wrapper div is added !
                    targetHelpzones: inst.options.zones.find("." + plugin.markerClassNameWrapper),
                    newContent: inst.options.content.call(input[0])
                };
                var beforeUpdateEvent = $.Event("helpzonebeforeupdate");
                
                beforeUpdateEvent.target = input[0]; // set target event so delegated event can work
                if ($.isFunction(inst.options.beforeUpdate)) { // call custom event handler before update
                    if (inst.options.beforeUpdate.call(input[0], beforeUpdateEvent, eventParams) === false) { //cancel if returns false
                        return;
                    }
                }

                input.trigger(beforeUpdateEvent, [eventParams]); // trigger our custom event before update
                if (!beforeUpdateEvent.isDefaultPrevented()) { // if not prevented
                    plugin._updateHelpZonesContent(input, inst, eventParams.newContent);
                }
            });
			
            // store but remove title attribute because we don't want to see it on hover
            if (inst.options.suppress) {
                this._switchAttribute(input[0], "title", "oldtitle");
            }

            $.each(inst.options.zones, function (i, zone) {
                var zone = $(zone);
                if (!zone.length) { // if zone not in DOM, append to end of body
                    $('body').append(zone);
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
         * Put oldName attribute content into newName attribute and remove oldName attribute
         * @param {element} input the element onto which perform the switch
         * @param {String} oldName the attribute to be replaced with newName
         * @param {String} newName the attribute to replace oldName with
        */
        _switchAttribute: function (input, oldName, newName) {
            input = $(input);
            input.attr(newName, input.attr(oldName)).removeAttr(oldName);
        },

        /**
         * Update content immediately from custom content if present or from calling the content callback otherwise.
         * Does not call beforeUpdate() nor trigger helpzonebeforeupdate custom Event.
         * @param {element} input the input element the helpzone refers to
         * @param {String} content string
         */
        _updatePlugin: function(input, content) {
            input = $(input);
            
            if (!input.hasClass(this.markerClassNameSource)) {
                return;
            }
            var inst = input.data(this.propertyName);
            content = content || inst.options.content.call(input[0]);
            this._updateHelpZonesContent(input, inst, content);
        },

        /**
        * Update content into the target zone.
        * It supports adding animation from custom show/hide callbacks by using .promise().
        * Ex: $("input").helpzone("option", "show", function (targetZone) {
        *  targetZone.fadeIn(800);
        *  /* or using jquery queue for custom animation * /
        *  targetZone.queue(function (next) {
        *    // custom animation code...
        *    next();
        *   });
        * });
        * @param {jQuery} input the jquery input element
        * @param {Object} inst the plugin instance
        * @param {String} content the html content as string to set in the target zone
        */
        _updateHelpZonesContent: function (input, inst, content) {
            inst.options.zones.each(function () {
                // WARNING: use find() instead of children() as if jquery ui effects are running, a wrapper div is added !
                var targetZone = $(this).find("." + plugin.markerClassNameWrapper);
                (inst.options.hide || $.noop).call(input[0], targetZone); // call hide callback

                targetZone.promise().done(function () { // once hidden animation done (resolved instantly if no animation)

                    targetZone.hide().html(content).val(content); // display none before setting new content
                    (inst.options.afterHide || $.noop).call(input[0], targetZone);
                    (inst.options.show || $.noop).call(input[0], targetZone); // call show callback

                    targetZone.promise().done(function () { // once shown animation done (resolved instantly if no animation)
                        targetZone.show(); // now we can really show
                        (inst.options.afterShow || $.noop).call(input[0], targetZone);
                    });
                })
            });
        },
        
        /**
         * Get all help zones only in use by the input passed in argument
         * @param {element} input the input reference targetting the shared zone
         * @return {jQuery} a collection of 0 or more help zones that are not shared with any other input sources
        */
        _getHelpzonesOnlyUsedByInputSource: function (input) {
            input = $(input);
            var thisInputZones = input.data(plugin.propertyName).options.zones;
            var differentInputZones = $();

            $("." + this.markerClassNameSource).not(input).filter(function () {
                var candidateInputZonesArray = $(this).data(plugin.propertyName).options.zones.toArray();

                differentInputZones.add(thisInputZones.filter(function (index) {
                    return candidateInputZonesArray.indexOf(thisInputZones[index]) === -1;
                }));

            });

            return differentInputZones.length ? differentInputZones : thisInputZones;
        },

        /**
         * Considering the input in argument, look for each of its associated zones and restore original
         * if any of them is not used by another source input
         * @param input the source input
         * @param inst the instance plugin
         */
        _resetHelpzonesDefaults: function (input, inst) {
            // restore to initial state
            this._getHelpzonesOnlyUsedByInputSource(input[0])
                .removeClass(this.markerClassNameTarget)
                .each(function (i) {
                    $(this).html(inst.initialContent[i]);
                });
        },

        /**
         * Get the content to be added to the helpzone
         * @param {element} input the input we want the content from
         * @returns {String} the htmlString of the content
         */
        _contentPlugin: function (input) {
            input = $(input);
            
            if (!input.hasClass(this.markerClassNameSource)) {
                return;
            }
            var inst = input.data(this.propertyName);
            return inst.options.content.call(input[0]);
        },

        /**
         * Remove the plugin attached to the input to restore it to its initial state before applying the plugin
         * @param {element} input the input to remove the plugin from
        */
        _destroyPlugin: function (input) {
            input = $(input);
           
            if (!input.hasClass(this.markerClassNameSource)) {
                return;
            }
            var inst = input.data(this.propertyName);

            this._resetHelpzonesDefaults(input, inst);

            input.removeClass(this.markerClassNameSource);
            input.removeData(this.propertyName);
            input.off(inst.options.event + '.' + this.propertyName);

            if (inst.options.suppress) {
                this._switchAttribute(input[0], "oldtitle", "title");
            }
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
        return this.each(function() {
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
}));
