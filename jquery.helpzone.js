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
            content: function (input) { // function that get the content to display
                return $(input).attr('oldtitle'); // oldtitle contains original title attribute
            },
            beforeUpdate: null // callback to call before target zone is updated
        };
    }

    
    // par conventions, on utilise '_' pour dire qu'une fonction ne doit jamais être evoquées directement par le user mais en interne par notre plugin
    // markerClassName & propertyName sont des noms souvent rencontrés dans les plugins jQuery
    $.extend(HelpZone.prototype, {
        markerClassNameSource: 'fab-hasSourceHelpZone', // tag l'input comme etant attaché au plugin
        propertyName: 'fab-sourcehelpzone', // data attribute où on pourra retrouver l'instance de notre plugin
        markerClassNameTarget: 'fab-hasTargetHelpZone',
        
        _beforeUpdateEvent: $.Event("helpzonebeforeupdate"),
        
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
                initialContent: options.zone.html()
            };
            input.addClass(this.markerClassNameSource)
                    .data(this.propertyName, inst);

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
                if (this._getOtherSourcesWithSameHelpZoneTarget(input[0]).length === 0) {
                    inst.options.zone.removeClass(this.markerClassNameTarget);
                    this._updateHelpZoneContent(inst.options.zone, inst.options.initialContent);
                }
                options.zone.addClass(this.markerClassNameTarget);
            }
            
            input.off(inst.options.event + '.' + this.propertyName);
            
            $.extend(inst.options, options); // update with new options 
						// from now on options have been merged
            input.on(inst.options.event + '.' + this.propertyName, function () {
                plugin._beforeUpdateEvent.target = input[0]; // set target event so delegated event can work
                if ($.isFunction(inst.options.beforeUpdate)) { // call custom event handler before update
                    inst.options.beforeUpdate.call(input, plugin._beforeUpdateEvent, inst.options.zone);
                }
                input.trigger(plugin._beforeUpdateEvent, [inst.options.zone]); // trigger our custom event before update
                if (!plugin._beforeUpdateEvent.isDefaultPrevented()) { // if not prevented
                    plugin._updateHelpZoneContent(inst.options.zone, inst.options.content(input));
                }
            });
						//
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
				_switchAttributes: function (input, oldName, newName) {
						input = $(input);
						input.attr(newName, input.attr(oldName)).removeAttr(oldName);
				},
        
				/**
				 * update content into the target zone
				 * @param {jQuery} helpZone the target zone
				 * @param {String} content the html content as string to set in the target zone
				 */
        _updateHelpZoneContent: function (helpZone, content) {
            // using html() and val() chained makes it compatible with both standard dom elements and input text type/textarea
            helpZone.empty().html(content).val(content);
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
                inst.options.zone.removeClass(this.markerClassNameTarget);
                this._updateHelpZoneContent(inst.options.zone, inst.options.initialContent);
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
