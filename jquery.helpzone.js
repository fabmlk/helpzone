/**
 * Custom jquery plugin for binding inputs title attribute to display in a specified zone.
 * Usage minimum: $("input[type='text']").helpzone({target: $("#helpzone"));
 * This will make by default each input's title attribute be the content displayed in $("#helpzone") on focus
 * It can be customized with various options, including:
 *  - event: which event trigger the display to the helpzone (default: focus)
 *  - suppress: wether to remove the title attributes as title attributes are always shown on hover by the browser (default: true)
 *  - show/hide: callback functions when the old content is hidden and new content shown.
 *          Context is the current input element and the targetZone is passed as param.
 *          Supports animations by using .promise() internally.
 *          (default: null)
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
            zone: $("<div/>"), // target jquery element where to display the data content
            event: 'focus', // on which event we want to display the data content
            suppress: true, // boolean to tell if we want to remove title attribute or not
            show: null, // callback when new content is being shown
            hide: null, // callback when old content is being hidden
            content: function () { // function that get the content to display
                var title = $(this).attr("oldtitle"); // oldtitle contains original title attribute
                if (typeof title === 'undefined') { // in case suprress option is false
                    title = $(this).attr("title");
                }
                return title;
            },
            beforeUpdate: null // callback to call before target zone is updated.
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
                initialContent: options.zone.html() // keep initial content to restore it if needed
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
            if (options.zone) {
                if (this._getOtherSourcesWithSameHelpZoneTarget(input[0]).length === 0) { // only one helpzone used ?
                    inst.options.zone.removeClass(this.markerClassNameTarget) // set back to initial state
                        .html(inst.initialContent);
                }
                // format the new one
                options.zone.addClass(this.markerClassNameTarget);
                if (options.zone.children("." + this.markerClassNameWrapper).length === 0) {
                    // we add a wrapper inside the helpzone. This will be also very usefull when we allow the user
                    // to add custom show/hide callbacks for animation
                    options.zone.children().length ? // if has children, wrap with wrapper
                        options.zone.children().wrapAll("<div class='" + this.markerClassNameWrapper + "'>")
                        // else simply append wrapper
                        : options.zone.append("<div class='" + this.markerClassNameWrapper + "'>");
                }
            }
            
            input.off(inst.options.event + '.' + this.propertyName);
            
            $.extend(inst.options, options); // update with new options 
            
            // from now on options have been merged
            input.on(inst.options.event + '.' + this.propertyName, function () {
                var eventParams = { // object passed as params of custom event
                    helpzoneTarget: inst.options.zone.children("." + this.markerClassNameWrapper),
                    newContent: inst.options.content.call(input[0])
                };
                var beforeUpdateEvent = $.Event("helpzonebeforeupdate");
                
                beforeUpdateEvent.target = input[0]; // set target event so delegated event can work
                if ($.isFunction(inst.options.beforeUpdate)) { // call custom event handler before update
                    inst.options.beforeUpdate.call(input[0], beforeUpdateEvent, eventParams);
                }

                input.trigger(beforeUpdateEvent, [eventParams]); // trigger our custom event before update
                if (!beforeUpdateEvent.isDefaultPrevented()) { // if not prevented
                    plugin._updateHelpZoneContent(input, inst, eventParams.newContent);
                }
            });
			
            // store but remove title attribute because we don't want to see it on hover
            if (inst.options.suppress) {
                this._switchAttribute(input[0], "title", "oldtitle");
            }
            
            if (!inst.options.zone.length) { // if zone not in DOM, append to end of body
                $('body').append(inst.options.zone);
            }
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
            this._updateHelpZoneContent(input, inst, content);
        },

        /**
         * Update content into the target zone.
         * It supports adding animation from custom show/hide callbacks by using .promise().
         * Ex: $("input").helpzone("option", "show", function (targetZone) {
         *  targetZone.fadeIn(800);
         * });
         * @param {jQuery} input the jquery input element
         * @param {Object} inst the plugin instance
         * @param {String} content the html content as string to set in the target zone
        */
        _updateHelpZoneContent: function (input, inst, content) {
            var zoneTarget = inst.options.zone.children("." + this.markerClassNameWrapper);

            (inst.options.hide || $.noop).call(input[0], zoneTarget); // call hide callback

            zoneTarget.promise().done(function () { // once hidden animation done (resolved instantly if no animation)
                zoneTarget.hide().html(content).val(content); // display none before setting new content
                (inst.options.show || $.noop).call(input[0], zoneTarget); // call show callback
                zoneTarget.promise().done(function () { // once shown animation done (resolved instantly if no animation)
                    zoneTarget.show(); // now we can really show
                }); 
            })
        },
        
        /**
         * Get all inputs attached with the plugin sharing the same helpZone as the input passed in argument
         * @param {element} input the input reference targetting the shared zone
         * @return {jQuery} a collection of 0 or more inputs sharing the helpZone
        */
        _getOtherSourcesWithSameHelpZoneTarget: function (input) {
            input = $(input);
            return $("." + this.markerClassNameSource).not(input).filter(function () {
                return $(this).data(plugin.propertyName).options.zone[0] === $(input).data(plugin.propertyName).options.zone[0];
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

            input.removeClass(this.markerClassNameSource);
            input.removeData(this.propertyName);
            input.off(inst.options.event + '.' + this.propertyName);
						
            if (inst.options.suppress) {
                this._switchAttribute(input[0], "oldtitle", "title");
            }

            if (this._getOtherSourcesWithSameHelpZoneTarget(input[0]).length === 0) {
                inst.options.zone.removeClass(this.markerClassNameTarget).html(inst.initialContent);
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
