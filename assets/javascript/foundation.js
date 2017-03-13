!function ($) {

  "use strict";

  var FOUNDATION_VERSION = '6.3.0';

  // Global Foundation object
  // This is attached to the window, or used as a module for AMD/Browserify
  var Foundation = {
    version: FOUNDATION_VERSION,

    /**
     * Stores initialized plugins.
     */
    _plugins: {},

    /**
     * Stores generated unique ids for plugin instances
     */
    _uuids: [],

    /**
     * Returns a boolean for RTL support
     */
    rtl: function () {
      return $('html').attr('dir') === 'rtl';
    },
    /**
     * Defines a Foundation plugin, adding it to the `Foundation` namespace and the list of plugins to initialize when reflowing.
     * @param {Object} plugin - The constructor of the plugin.
     */
    plugin: function (plugin, name) {
      // Object key to use when adding to global Foundation object
      // Examples: Foundation.Reveal, Foundation.OffCanvas
      var className = name || functionName(plugin);
      // Object key to use when storing the plugin, also used to create the identifying data attribute for the plugin
      // Examples: data-reveal, data-off-canvas
      var attrName = hyphenate(className);

      // Add to the Foundation object and the plugins list (for reflowing)
      this._plugins[attrName] = this[className] = plugin;
    },
    /**
     * @function
     * Populates the _uuids array with pointers to each individual plugin instance.
     * Adds the `zfPlugin` data-attribute to programmatically created plugins to allow use of $(selector).foundation(method) calls.
     * Also fires the initialization event for each plugin, consolidating repetitive code.
     * @param {Object} plugin - an instance of a plugin, usually `this` in context.
     * @param {String} name - the name of the plugin, passed as a camelCased string.
     * @fires Plugin#init
     */
    registerPlugin: function (plugin, name) {
      var pluginName = name ? hyphenate(name) : functionName(plugin.constructor).toLowerCase();
      plugin.uuid = this.GetYoDigits(6, pluginName);

      if (!plugin.$element.attr(`data-${pluginName}`)) {
        plugin.$element.attr(`data-${pluginName}`, plugin.uuid);
      }
      if (!plugin.$element.data('zfPlugin')) {
        plugin.$element.data('zfPlugin', plugin);
      }
      /**
       * Fires when the plugin has initialized.
       * @event Plugin#init
       */
      plugin.$element.trigger(`init.zf.${pluginName}`);

      this._uuids.push(plugin.uuid);

      return;
    },
    /**
     * @function
     * Removes the plugins uuid from the _uuids array.
     * Removes the zfPlugin data attribute, as well as the data-plugin-name attribute.
     * Also fires the destroyed event for the plugin, consolidating repetitive code.
     * @param {Object} plugin - an instance of a plugin, usually `this` in context.
     * @fires Plugin#destroyed
     */
    unregisterPlugin: function (plugin) {
      var pluginName = hyphenate(functionName(plugin.$element.data('zfPlugin').constructor));

      this._uuids.splice(this._uuids.indexOf(plugin.uuid), 1);
      plugin.$element.removeAttr(`data-${pluginName}`).removeData('zfPlugin')
      /**
       * Fires when the plugin has been destroyed.
       * @event Plugin#destroyed
       */
      .trigger(`destroyed.zf.${pluginName}`);
      for (var prop in plugin) {
        plugin[prop] = null; //clean up script to prep for garbage collection.
      }
      return;
    },

    /**
     * @function
     * Causes one or more active plugins to re-initialize, resetting event listeners, recalculating positions, etc.
     * @param {String} plugins - optional string of an individual plugin key, attained by calling `$(element).data('pluginName')`, or string of a plugin class i.e. `'dropdown'`
     * @default If no argument is passed, reflow all currently active plugins.
     */
    reInit: function (plugins) {
      var isJQ = plugins instanceof $;
      try {
        if (isJQ) {
          plugins.each(function () {
            $(this).data('zfPlugin')._init();
          });
        } else {
          var type = typeof plugins,
              _this = this,
              fns = {
            'object': function (plgs) {
              plgs.forEach(function (p) {
                p = hyphenate(p);
                $('[data-' + p + ']').foundation('_init');
              });
            },
            'string': function () {
              plugins = hyphenate(plugins);
              $('[data-' + plugins + ']').foundation('_init');
            },
            'undefined': function () {
              this['object'](Object.keys(_this._plugins));
            }
          };
          fns[type](plugins);
        }
      } catch (err) {
        console.error(err);
      } finally {
        return plugins;
      }
    },

    /**
     * returns a random base-36 uid with namespacing
     * @function
     * @param {Number} length - number of random base-36 digits desired. Increase for more random strings.
     * @param {String} namespace - name of plugin to be incorporated in uid, optional.
     * @default {String} '' - if no plugin name is provided, nothing is appended to the uid.
     * @returns {String} - unique id
     */
    GetYoDigits: function (length, namespace) {
      length = length || 6;
      return Math.round(Math.pow(36, length + 1) - Math.random() * Math.pow(36, length)).toString(36).slice(1) + (namespace ? `-${namespace}` : '');
    },
    /**
     * Initialize plugins on any elements within `elem` (and `elem` itself) that aren't already initialized.
     * @param {Object} elem - jQuery object containing the element to check inside. Also checks the element itself, unless it's the `document` object.
     * @param {String|Array} plugins - A list of plugins to initialize. Leave this out to initialize everything.
     */
    reflow: function (elem, plugins) {

      // If plugins is undefined, just grab everything
      if (typeof plugins === 'undefined') {
        plugins = Object.keys(this._plugins);
      }
      // If plugins is a string, convert it to an array with one item
      else if (typeof plugins === 'string') {
          plugins = [plugins];
        }

      var _this = this;

      // Iterate through each plugin
      $.each(plugins, function (i, name) {
        // Get the current plugin
        var plugin = _this._plugins[name];

        // Localize the search to all elements inside elem, as well as elem itself, unless elem === document
        var $elem = $(elem).find('[data-' + name + ']').addBack('[data-' + name + ']');

        // For each plugin found, initialize it
        $elem.each(function () {
          var $el = $(this),
              opts = {};
          // Don't double-dip on plugins
          if ($el.data('zfPlugin')) {
            console.warn("Tried to initialize " + name + " on an element that already has a Foundation plugin.");
            return;
          }

          if ($el.attr('data-options')) {
            var thing = $el.attr('data-options').split(';').forEach(function (e, i) {
              var opt = e.split(':').map(function (el) {
                return el.trim();
              });
              if (opt[0]) opts[opt[0]] = parseValue(opt[1]);
            });
          }
          try {
            $el.data('zfPlugin', new plugin($(this), opts));
          } catch (er) {
            console.error(er);
          } finally {
            return;
          }
        });
      });
    },
    getFnName: functionName,
    transitionend: function ($elem) {
      var transitions = {
        'transition': 'transitionend',
        'WebkitTransition': 'webkitTransitionEnd',
        'MozTransition': 'transitionend',
        'OTransition': 'otransitionend'
      };
      var elem = document.createElement('div'),
          end;

      for (var t in transitions) {
        if (typeof elem.style[t] !== 'undefined') {
          end = transitions[t];
        }
      }
      if (end) {
        return end;
      } else {
        end = setTimeout(function () {
          $elem.triggerHandler('transitionend', [$elem]);
        }, 1);
        return 'transitionend';
      }
    }
  };

  Foundation.util = {
    /**
     * Function for applying a debounce effect to a function call.
     * @function
     * @param {Function} func - Function to be called at end of timeout.
     * @param {Number} delay - Time in ms to delay the call of `func`.
     * @returns function
     */
    throttle: function (func, delay) {
      var timer = null;

      return function () {
        var context = this,
            args = arguments;

        if (timer === null) {
          timer = setTimeout(function () {
            func.apply(context, args);
            timer = null;
          }, delay);
        }
      };
    }
  };

  // TODO: consider not making this a jQuery function
  // TODO: need way to reflow vs. re-initialize
  /**
   * The Foundation jQuery method.
   * @param {String|Array} method - An action to perform on the current jQuery object.
   */
  var foundation = function (method) {
    var type = typeof method,
        $meta = $('meta.foundation-mq'),
        $noJS = $('.no-js');

    if (!$meta.length) {
      $('<meta class="foundation-mq">').appendTo(document.head);
    }
    if ($noJS.length) {
      $noJS.removeClass('no-js');
    }

    if (type === 'undefined') {
      //needs to initialize the Foundation object, or an individual plugin.
      Foundation.MediaQuery._init();
      Foundation.reflow(this);
    } else if (type === 'string') {
      //an individual method to invoke on a plugin or group of plugins
      var args = Array.prototype.slice.call(arguments, 1); //collect all the arguments, if necessary
      var plugClass = this.data('zfPlugin'); //determine the class of plugin

      if (plugClass !== undefined && plugClass[method] !== undefined) {
        //make sure both the class and method exist
        if (this.length === 1) {
          //if there's only one, call it directly.
          plugClass[method].apply(plugClass, args);
        } else {
          this.each(function (i, el) {
            //otherwise loop through the jQuery collection and invoke the method on each
            plugClass[method].apply($(el).data('zfPlugin'), args);
          });
        }
      } else {
        //error for no class or no method
        throw new ReferenceError("We're sorry, '" + method + "' is not an available method for " + (plugClass ? functionName(plugClass) : 'this element') + '.');
      }
    } else {
      //error for invalid argument type
      throw new TypeError(`We're sorry, ${type} is not a valid parameter. You must use a string representing the method you wish to invoke.`);
    }
    return this;
  };

  window.Foundation = Foundation;
  $.fn.foundation = foundation;

  // Polyfill for requestAnimationFrame
  (function () {
    if (!Date.now || !window.Date.now) window.Date.now = Date.now = function () {
      return new Date().getTime();
    };

    var vendors = ['webkit', 'moz'];
    for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
      var vp = vendors[i];
      window.requestAnimationFrame = window[vp + 'RequestAnimationFrame'];
      window.cancelAnimationFrame = window[vp + 'CancelAnimationFrame'] || window[vp + 'CancelRequestAnimationFrame'];
    }
    if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
      var lastTime = 0;
      window.requestAnimationFrame = function (callback) {
        var now = Date.now();
        var nextTime = Math.max(lastTime + 16, now);
        return setTimeout(function () {
          callback(lastTime = nextTime);
        }, nextTime - now);
      };
      window.cancelAnimationFrame = clearTimeout;
    }
    /**
     * Polyfill for performance.now, required by rAF
     */
    if (!window.performance || !window.performance.now) {
      window.performance = {
        start: Date.now(),
        now: function () {
          return Date.now() - this.start;
        }
      };
    }
  })();
  if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
      if (typeof this !== 'function') {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
      }

      var aArgs = Array.prototype.slice.call(arguments, 1),
          fToBind = this,
          fNOP = function () {},
          fBound = function () {
        return fToBind.apply(this instanceof fNOP ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
      };

      if (this.prototype) {
        // native functions don't have a prototype
        fNOP.prototype = this.prototype;
      }
      fBound.prototype = new fNOP();

      return fBound;
    };
  }
  // Polyfill to get the name of a function in IE9
  function functionName(fn) {
    if (Function.prototype.name === undefined) {
      var funcNameRegex = /function\s([^(]{1,})\(/;
      var results = funcNameRegex.exec(fn.toString());
      return results && results.length > 1 ? results[1].trim() : "";
    } else if (fn.prototype === undefined) {
      return fn.constructor.name;
    } else {
      return fn.prototype.constructor.name;
    }
  }
  function parseValue(str) {
    if ('true' === str) return true;else if ('false' === str) return false;else if (!isNaN(str * 1)) return parseFloat(str);
    return str;
  }
  // Convert PascalCase to kebab-case
  // Thank you: http://stackoverflow.com/a/8955580
  function hyphenate(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}(jQuery);
;'use strict';

!function ($) {

  Foundation.Box = {
    ImNotTouchingYou: ImNotTouchingYou,
    GetDimensions: GetDimensions,
    GetOffsets: GetOffsets
  };

  /**
   * Compares the dimensions of an element to a container and determines collision events with container.
   * @function
   * @param {jQuery} element - jQuery object to test for collisions.
   * @param {jQuery} parent - jQuery object to use as bounding container.
   * @param {Boolean} lrOnly - set to true to check left and right values only.
   * @param {Boolean} tbOnly - set to true to check top and bottom values only.
   * @default if no parent object passed, detects collisions with `window`.
   * @returns {Boolean} - true if collision free, false if a collision in any direction.
   */
  function ImNotTouchingYou(element, parent, lrOnly, tbOnly) {
    var eleDims = GetDimensions(element),
        top,
        bottom,
        left,
        right;

    if (parent) {
      var parDims = GetDimensions(parent);

      bottom = eleDims.offset.top + eleDims.height <= parDims.height + parDims.offset.top;
      top = eleDims.offset.top >= parDims.offset.top;
      left = eleDims.offset.left >= parDims.offset.left;
      right = eleDims.offset.left + eleDims.width <= parDims.width + parDims.offset.left;
    } else {
      bottom = eleDims.offset.top + eleDims.height <= eleDims.windowDims.height + eleDims.windowDims.offset.top;
      top = eleDims.offset.top >= eleDims.windowDims.offset.top;
      left = eleDims.offset.left >= eleDims.windowDims.offset.left;
      right = eleDims.offset.left + eleDims.width <= eleDims.windowDims.width;
    }

    var allDirs = [bottom, top, left, right];

    if (lrOnly) {
      return left === right === true;
    }

    if (tbOnly) {
      return top === bottom === true;
    }

    return allDirs.indexOf(false) === -1;
  };

  /**
   * Uses native methods to return an object of dimension values.
   * @function
   * @param {jQuery || HTML} element - jQuery object or DOM element for which to get the dimensions. Can be any element other that document or window.
   * @returns {Object} - nested object of integer pixel values
   * TODO - if element is window, return only those values.
   */
  function GetDimensions(elem, test) {
    elem = elem.length ? elem[0] : elem;

    if (elem === window || elem === document) {
      throw new Error("I'm sorry, Dave. I'm afraid I can't do that.");
    }

    var rect = elem.getBoundingClientRect(),
        parRect = elem.parentNode.getBoundingClientRect(),
        winRect = document.body.getBoundingClientRect(),
        winY = window.pageYOffset,
        winX = window.pageXOffset;

    return {
      width: rect.width,
      height: rect.height,
      offset: {
        top: rect.top + winY,
        left: rect.left + winX
      },
      parentDims: {
        width: parRect.width,
        height: parRect.height,
        offset: {
          top: parRect.top + winY,
          left: parRect.left + winX
        }
      },
      windowDims: {
        width: winRect.width,
        height: winRect.height,
        offset: {
          top: winY,
          left: winX
        }
      }
    };
  }

  /**
   * Returns an object of top and left integer pixel values for dynamically rendered elements,
   * such as: Tooltip, Reveal, and Dropdown
   * @function
   * @param {jQuery} element - jQuery object for the element being positioned.
   * @param {jQuery} anchor - jQuery object for the element's anchor point.
   * @param {String} position - a string relating to the desired position of the element, relative to it's anchor
   * @param {Number} vOffset - integer pixel value of desired vertical separation between anchor and element.
   * @param {Number} hOffset - integer pixel value of desired horizontal separation between anchor and element.
   * @param {Boolean} isOverflow - if a collision event is detected, sets to true to default the element to full width - any desired offset.
   * TODO alter/rewrite to work with `em` values as well/instead of pixels
   */
  function GetOffsets(element, anchor, position, vOffset, hOffset, isOverflow) {
    var $eleDims = GetDimensions(element),
        $anchorDims = anchor ? GetDimensions(anchor) : null;

    switch (position) {
      case 'top':
        return {
          left: Foundation.rtl() ? $anchorDims.offset.left - $eleDims.width + $anchorDims.width : $anchorDims.offset.left,
          top: $anchorDims.offset.top - ($eleDims.height + vOffset)
        };
        break;
      case 'left':
        return {
          left: $anchorDims.offset.left - ($eleDims.width + hOffset),
          top: $anchorDims.offset.top
        };
        break;
      case 'right':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset,
          top: $anchorDims.offset.top
        };
        break;
      case 'center top':
        return {
          left: $anchorDims.offset.left + $anchorDims.width / 2 - $eleDims.width / 2,
          top: $anchorDims.offset.top - ($eleDims.height + vOffset)
        };
        break;
      case 'center bottom':
        return {
          left: isOverflow ? hOffset : $anchorDims.offset.left + $anchorDims.width / 2 - $eleDims.width / 2,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
        break;
      case 'center left':
        return {
          left: $anchorDims.offset.left - ($eleDims.width + hOffset),
          top: $anchorDims.offset.top + $anchorDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'center right':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset + 1,
          top: $anchorDims.offset.top + $anchorDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'center':
        return {
          left: $eleDims.windowDims.offset.left + $eleDims.windowDims.width / 2 - $eleDims.width / 2,
          top: $eleDims.windowDims.offset.top + $eleDims.windowDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'reveal':
        return {
          left: ($eleDims.windowDims.width - $eleDims.width) / 2,
          top: $eleDims.windowDims.offset.top + vOffset
        };
      case 'reveal full':
        return {
          left: $eleDims.windowDims.offset.left,
          top: $eleDims.windowDims.offset.top
        };
        break;
      case 'left bottom':
        return {
          left: $anchorDims.offset.left,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
        break;
      case 'right bottom':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset - $eleDims.width,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
        break;
      default:
        return {
          left: Foundation.rtl() ? $anchorDims.offset.left - $eleDims.width + $anchorDims.width : $anchorDims.offset.left + hOffset,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
    }
  }
}(jQuery);
;/*******************************************
 *                                         *
 * This util was created by Marius Olbertz *
 * Please thank Marius on GitHub /owlbertz *
 * or the web http://www.mariusolbertz.de/ *
 *                                         *
 ******************************************/

'use strict';

!function ($) {

  const keyCodes = {
    9: 'TAB',
    13: 'ENTER',
    27: 'ESCAPE',
    32: 'SPACE',
    37: 'ARROW_LEFT',
    38: 'ARROW_UP',
    39: 'ARROW_RIGHT',
    40: 'ARROW_DOWN'
  };

  var commands = {};

  var Keyboard = {
    keys: getKeyCodes(keyCodes),

    /**
     * Parses the (keyboard) event and returns a String that represents its key
     * Can be used like Foundation.parseKey(event) === Foundation.keys.SPACE
     * @param {Event} event - the event generated by the event handler
     * @return String key - String that represents the key pressed
     */
    parseKey(event) {
      var key = keyCodes[event.which || event.keyCode] || String.fromCharCode(event.which).toUpperCase();

      // Remove un-printable characters, e.g. for `fromCharCode` calls for CTRL only events
      key = key.replace(/\W+/, '');

      if (event.shiftKey) key = `SHIFT_${key}`;
      if (event.ctrlKey) key = `CTRL_${key}`;
      if (event.altKey) key = `ALT_${key}`;

      // Remove trailing underscore, in case only modifiers were used (e.g. only `CTRL_ALT`)
      key = key.replace(/_$/, '');

      return key;
    },

    /**
     * Handles the given (keyboard) event
     * @param {Event} event - the event generated by the event handler
     * @param {String} component - Foundation component's name, e.g. Slider or Reveal
     * @param {Objects} functions - collection of functions that are to be executed
     */
    handleKey(event, component, functions) {
      var commandList = commands[component],
          keyCode = this.parseKey(event),
          cmds,
          command,
          fn;

      if (!commandList) return console.warn('Component not defined!');

      if (typeof commandList.ltr === 'undefined') {
        // this component does not differentiate between ltr and rtl
        cmds = commandList; // use plain list
      } else {
        // merge ltr and rtl: if document is rtl, rtl overwrites ltr and vice versa
        if (Foundation.rtl()) cmds = $.extend({}, commandList.ltr, commandList.rtl);else cmds = $.extend({}, commandList.rtl, commandList.ltr);
      }
      command = cmds[keyCode];

      fn = functions[command];
      if (fn && typeof fn === 'function') {
        // execute function  if exists
        var returnValue = fn.apply();
        if (functions.handled || typeof functions.handled === 'function') {
          // execute function when event was handled
          functions.handled(returnValue);
        }
      } else {
        if (functions.unhandled || typeof functions.unhandled === 'function') {
          // execute function when event was not handled
          functions.unhandled();
        }
      }
    },

    /**
     * Finds all focusable elements within the given `$element`
     * @param {jQuery} $element - jQuery object to search within
     * @return {jQuery} $focusable - all focusable elements within `$element`
     */
    findFocusable($element) {
      if (!$element) {
        return false;
      }
      return $element.find('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, *[tabindex], *[contenteditable]').filter(function () {
        if (!$(this).is(':visible') || $(this).attr('tabindex') < 0) {
          return false;
        } //only have visible elements and those that have a tabindex greater or equal 0
        return true;
      });
    },

    /**
     * Returns the component name name
     * @param {Object} component - Foundation component, e.g. Slider or Reveal
     * @return String componentName
     */

    register(componentName, cmds) {
      commands[componentName] = cmds;
    },

    /**
     * Traps the focus in the given element.
     * @param  {jQuery} $element  jQuery object to trap the foucs into.
     */
    trapFocus($element) {
      var $focusable = Foundation.Keyboard.findFocusable($element),
          $firstFocusable = $focusable.eq(0),
          $lastFocusable = $focusable.eq(-1);

      $element.on('keydown.zf.trapfocus', function (event) {
        if (event.target === $lastFocusable[0] && Foundation.Keyboard.parseKey(event) === 'TAB') {
          event.preventDefault();
          $firstFocusable.focus();
        } else if (event.target === $firstFocusable[0] && Foundation.Keyboard.parseKey(event) === 'SHIFT_TAB') {
          event.preventDefault();
          $lastFocusable.focus();
        }
      });
    },
    /**
     * Releases the trapped focus from the given element.
     * @param  {jQuery} $element  jQuery object to release the focus for.
     */
    releaseFocus($element) {
      $element.off('keydown.zf.trapfocus');
    }
  };

  /*
   * Constants for easier comparing.
   * Can be used like Foundation.parseKey(event) === Foundation.keys.SPACE
   */
  function getKeyCodes(kcs) {
    var k = {};
    for (var kc in kcs) k[kcs[kc]] = kcs[kc];
    return k;
  }

  Foundation.Keyboard = Keyboard;
}(jQuery);
;'use strict';

!function ($) {

  // Default set of media queries
  const defaultQueries = {
    'default': 'only screen',
    landscape: 'only screen and (orientation: landscape)',
    portrait: 'only screen and (orientation: portrait)',
    retina: 'only screen and (-webkit-min-device-pixel-ratio: 2),' + 'only screen and (min--moz-device-pixel-ratio: 2),' + 'only screen and (-o-min-device-pixel-ratio: 2/1),' + 'only screen and (min-device-pixel-ratio: 2),' + 'only screen and (min-resolution: 192dpi),' + 'only screen and (min-resolution: 2dppx)'
  };

  var MediaQuery = {
    queries: [],

    current: '',

    /**
     * Initializes the media query helper, by extracting the breakpoint list from the CSS and activating the breakpoint watcher.
     * @function
     * @private
     */
    _init() {
      var self = this;
      var extractedStyles = $('.foundation-mq').css('font-family');
      var namedQueries;

      namedQueries = parseStyleToObject(extractedStyles);

      for (var key in namedQueries) {
        if (namedQueries.hasOwnProperty(key)) {
          self.queries.push({
            name: key,
            value: `only screen and (min-width: ${namedQueries[key]})`
          });
        }
      }

      this.current = this._getCurrentSize();

      this._watcher();
    },

    /**
     * Checks if the screen is at least as wide as a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to check.
     * @returns {Boolean} `true` if the breakpoint matches, `false` if it's smaller.
     */
    atLeast(size) {
      var query = this.get(size);

      if (query) {
        return window.matchMedia(query).matches;
      }

      return false;
    },

    /**
     * Checks if the screen matches to a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to check, either 'small only' or 'small'. Omitting 'only' falls back to using atLeast() method.
     * @returns {Boolean} `true` if the breakpoint matches, `false` if it does not.
     */
    is(size) {
      size = size.trim().split(' ');
      if (size.length > 1 && size[1] === 'only') {
        if (size[0] === this._getCurrentSize()) return true;
      } else {
        return this.atLeast(size[0]);
      }
      return false;
    },

    /**
     * Gets the media query of a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to get.
     * @returns {String|null} - The media query of the breakpoint, or `null` if the breakpoint doesn't exist.
     */
    get(size) {
      for (var i in this.queries) {
        if (this.queries.hasOwnProperty(i)) {
          var query = this.queries[i];
          if (size === query.name) return query.value;
        }
      }

      return null;
    },

    /**
     * Gets the current breakpoint name by testing every breakpoint and returning the last one to match (the biggest one).
     * @function
     * @private
     * @returns {String} Name of the current breakpoint.
     */
    _getCurrentSize() {
      var matched;

      for (var i = 0; i < this.queries.length; i++) {
        var query = this.queries[i];

        if (window.matchMedia(query.value).matches) {
          matched = query;
        }
      }

      if (typeof matched === 'object') {
        return matched.name;
      } else {
        return matched;
      }
    },

    /**
     * Activates the breakpoint watcher, which fires an event on the window whenever the breakpoint changes.
     * @function
     * @private
     */
    _watcher() {
      $(window).on('resize.zf.mediaquery', () => {
        var newSize = this._getCurrentSize(),
            currentSize = this.current;

        if (newSize !== currentSize) {
          // Change the current media query
          this.current = newSize;

          // Broadcast the media query change on the window
          $(window).trigger('changed.zf.mediaquery', [newSize, currentSize]);
        }
      });
    }
  };

  Foundation.MediaQuery = MediaQuery;

  // matchMedia() polyfill - Test a CSS media type/query in JS.
  // Authors & copyright (c) 2012: Scott Jehl, Paul Irish, Nicholas Zakas, David Knight. Dual MIT/BSD license
  window.matchMedia || (window.matchMedia = function () {
    'use strict';

    // For browsers that support matchMedium api such as IE 9 and webkit

    var styleMedia = window.styleMedia || window.media;

    // For those that don't support matchMedium
    if (!styleMedia) {
      var style = document.createElement('style'),
          script = document.getElementsByTagName('script')[0],
          info = null;

      style.type = 'text/css';
      style.id = 'matchmediajs-test';

      script && script.parentNode && script.parentNode.insertBefore(style, script);

      // 'style.currentStyle' is used by IE <= 8 and 'window.getComputedStyle' for all other browsers
      info = 'getComputedStyle' in window && window.getComputedStyle(style, null) || style.currentStyle;

      styleMedia = {
        matchMedium(media) {
          var text = `@media ${media}{ #matchmediajs-test { width: 1px; } }`;

          // 'style.styleSheet' is used by IE <= 8 and 'style.textContent' for all other browsers
          if (style.styleSheet) {
            style.styleSheet.cssText = text;
          } else {
            style.textContent = text;
          }

          // Test if media query is true or false
          return info.width === '1px';
        }
      };
    }

    return function (media) {
      return {
        matches: styleMedia.matchMedium(media || 'all'),
        media: media || 'all'
      };
    };
  }());

  // Thank you: https://github.com/sindresorhus/query-string
  function parseStyleToObject(str) {
    var styleObject = {};

    if (typeof str !== 'string') {
      return styleObject;
    }

    str = str.trim().slice(1, -1); // browsers re-quote string style values

    if (!str) {
      return styleObject;
    }

    styleObject = str.split('&').reduce(function (ret, param) {
      var parts = param.replace(/\+/g, ' ').split('=');
      var key = parts[0];
      var val = parts[1];
      key = decodeURIComponent(key);

      // missing `=` should be `null`:
      // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
      val = val === undefined ? null : decodeURIComponent(val);

      if (!ret.hasOwnProperty(key)) {
        ret[key] = val;
      } else if (Array.isArray(ret[key])) {
        ret[key].push(val);
      } else {
        ret[key] = [ret[key], val];
      }
      return ret;
    }, {});

    return styleObject;
  }

  Foundation.MediaQuery = MediaQuery;
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Motion module.
   * @module foundation.motion
   */

  const initClasses = ['mui-enter', 'mui-leave'];
  const activeClasses = ['mui-enter-active', 'mui-leave-active'];

  const Motion = {
    animateIn: function (element, animation, cb) {
      animate(true, element, animation, cb);
    },

    animateOut: function (element, animation, cb) {
      animate(false, element, animation, cb);
    }
  };

  function Move(duration, elem, fn) {
    var anim,
        prog,
        start = null;
    // console.log('called');

    if (duration === 0) {
      fn.apply(elem);
      elem.trigger('finished.zf.animate', [elem]).triggerHandler('finished.zf.animate', [elem]);
      return;
    }

    function move(ts) {
      if (!start) start = ts;
      // console.log(start, ts);
      prog = ts - start;
      fn.apply(elem);

      if (prog < duration) {
        anim = window.requestAnimationFrame(move, elem);
      } else {
        window.cancelAnimationFrame(anim);
        elem.trigger('finished.zf.animate', [elem]).triggerHandler('finished.zf.animate', [elem]);
      }
    }
    anim = window.requestAnimationFrame(move);
  }

  /**
   * Animates an element in or out using a CSS transition class.
   * @function
   * @private
   * @param {Boolean} isIn - Defines if the animation is in or out.
   * @param {Object} element - jQuery or HTML object to animate.
   * @param {String} animation - CSS class to use.
   * @param {Function} cb - Callback to run when animation is finished.
   */
  function animate(isIn, element, animation, cb) {
    element = $(element).eq(0);

    if (!element.length) return;

    var initClass = isIn ? initClasses[0] : initClasses[1];
    var activeClass = isIn ? activeClasses[0] : activeClasses[1];

    // Set up the animation
    reset();

    element.addClass(animation).css('transition', 'none');

    requestAnimationFrame(() => {
      element.addClass(initClass);
      if (isIn) element.show();
    });

    // Start the animation
    requestAnimationFrame(() => {
      element[0].offsetWidth;
      element.css('transition', '').addClass(activeClass);
    });

    // Clean up the animation when it finishes
    element.one(Foundation.transitionend(element), finish);

    // Hides the element (for out animations), resets the element, and runs a callback
    function finish() {
      if (!isIn) element.hide();
      reset();
      if (cb) cb.apply(element);
    }

    // Resets transitions and removes motion-specific classes
    function reset() {
      element[0].style.transitionDuration = 0;
      element.removeClass(`${initClass} ${activeClass} ${animation}`);
    }
  }

  Foundation.Move = Move;
  Foundation.Motion = Motion;
}(jQuery);
;'use strict';

!function ($) {

  const Nest = {
    Feather(menu, type = 'zf') {
      menu.attr('role', 'menubar');

      var items = menu.find('li').attr({ 'role': 'menuitem' }),
          subMenuClass = `is-${type}-submenu`,
          subItemClass = `${subMenuClass}-item`,
          hasSubClass = `is-${type}-submenu-parent`;

      items.each(function () {
        var $item = $(this),
            $sub = $item.children('ul');

        if ($sub.length) {
          $item.addClass(hasSubClass).attr({
            'aria-haspopup': true,
            'aria-label': $item.children('a:first').text()
          });
          // Note:  Drilldowns behave differently in how they hide, and so need
          // additional attributes.  We should look if this possibly over-generalized
          // utility (Nest) is appropriate when we rework menus in 6.4
          if (type === 'drilldown') {
            $item.attr({ 'aria-expanded': false });
          }

          $sub.addClass(`submenu ${subMenuClass}`).attr({
            'data-submenu': '',
            'role': 'menu'
          });
          if (type === 'drilldown') {
            $sub.attr({ 'aria-hidden': true });
          }
        }

        if ($item.parent('[data-submenu]').length) {
          $item.addClass(`is-submenu-item ${subItemClass}`);
        }
      });

      return;
    },

    Burn(menu, type) {
      var //items = menu.find('li'),
      subMenuClass = `is-${type}-submenu`,
          subItemClass = `${subMenuClass}-item`,
          hasSubClass = `is-${type}-submenu-parent`;

      menu.find('>li, .menu, .menu > li').removeClass(`${subMenuClass} ${subItemClass} ${hasSubClass} is-submenu-item submenu is-active`).removeAttr('data-submenu').css('display', '');

      // console.log(      menu.find('.' + subMenuClass + ', .' + subItemClass + ', .has-submenu, .is-submenu-item, .submenu, [data-submenu]')
      //           .removeClass(subMenuClass + ' ' + subItemClass + ' has-submenu is-submenu-item submenu')
      //           .removeAttr('data-submenu'));
      // items.each(function(){
      //   var $item = $(this),
      //       $sub = $item.children('ul');
      //   if($item.parent('[data-submenu]').length){
      //     $item.removeClass('is-submenu-item ' + subItemClass);
      //   }
      //   if($sub.length){
      //     $item.removeClass('has-submenu');
      //     $sub.removeClass('submenu ' + subMenuClass).removeAttr('data-submenu');
      //   }
      // });
    }
  };

  Foundation.Nest = Nest;
}(jQuery);
;'use strict';

!function ($) {

  function Timer(elem, options, cb) {
    var _this = this,
        duration = options.duration,
        //options is an object for easily adding features later.
    nameSpace = Object.keys(elem.data())[0] || 'timer',
        remain = -1,
        start,
        timer;

    this.isPaused = false;

    this.restart = function () {
      remain = -1;
      clearTimeout(timer);
      this.start();
    };

    this.start = function () {
      this.isPaused = false;
      // if(!elem.data('paused')){ return false; }//maybe implement this sanity check if used for other things.
      clearTimeout(timer);
      remain = remain <= 0 ? duration : remain;
      elem.data('paused', false);
      start = Date.now();
      timer = setTimeout(function () {
        if (options.infinite) {
          _this.restart(); //rerun the timer.
        }
        if (cb && typeof cb === 'function') {
          cb();
        }
      }, remain);
      elem.trigger(`timerstart.zf.${nameSpace}`);
    };

    this.pause = function () {
      this.isPaused = true;
      //if(elem.data('paused')){ return false; }//maybe implement this sanity check if used for other things.
      clearTimeout(timer);
      elem.data('paused', true);
      var end = Date.now();
      remain = remain - (end - start);
      elem.trigger(`timerpaused.zf.${nameSpace}`);
    };
  }

  /**
   * Runs a callback function when images are fully loaded.
   * @param {Object} images - Image(s) to check if loaded.
   * @param {Func} callback - Function to execute when image is fully loaded.
   */
  function onImagesLoaded(images, callback) {
    var self = this,
        unloaded = images.length;

    if (unloaded === 0) {
      callback();
    }

    images.each(function () {
      // Check if image is loaded
      if (this.complete || this.readyState === 4 || this.readyState === 'complete') {
        singleImageLoaded();
      }
      // Force load the image
      else {
          // fix for IE. See https://css-tricks.com/snippets/jquery/fixing-load-in-ie-for-cached-images/
          var src = $(this).attr('src');
          $(this).attr('src', src + '?' + new Date().getTime());
          $(this).one('load', function () {
            singleImageLoaded();
          });
        }
    });

    function singleImageLoaded() {
      unloaded--;
      if (unloaded === 0) {
        callback();
      }
    }
  }

  Foundation.Timer = Timer;
  Foundation.onImagesLoaded = onImagesLoaded;
}(jQuery);
;//**************************************************
//**Work inspired by multiple jquery swipe plugins**
//**Done by Yohai Ararat ***************************
//**************************************************
(function ($) {

		$.spotSwipe = {
				version: '1.0.0',
				enabled: 'ontouchstart' in document.documentElement,
				preventDefault: false,
				moveThreshold: 75,
				timeThreshold: 200
		};

		var startPosX,
		    startPosY,
		    startTime,
		    elapsedTime,
		    isMoving = false;

		function onTouchEnd() {
				//  alert(this);
				this.removeEventListener('touchmove', onTouchMove);
				this.removeEventListener('touchend', onTouchEnd);
				isMoving = false;
		}

		function onTouchMove(e) {
				if ($.spotSwipe.preventDefault) {
						e.preventDefault();
				}
				if (isMoving) {
						var x = e.touches[0].pageX;
						var y = e.touches[0].pageY;
						var dx = startPosX - x;
						var dy = startPosY - y;
						var dir;
						elapsedTime = new Date().getTime() - startTime;
						if (Math.abs(dx) >= $.spotSwipe.moveThreshold && elapsedTime <= $.spotSwipe.timeThreshold) {
								dir = dx > 0 ? 'left' : 'right';
						}
						// else if(Math.abs(dy) >= $.spotSwipe.moveThreshold && elapsedTime <= $.spotSwipe.timeThreshold) {
						//   dir = dy > 0 ? 'down' : 'up';
						// }
						if (dir) {
								e.preventDefault();
								onTouchEnd.call(this);
								$(this).trigger('swipe', dir).trigger(`swipe${dir}`);
						}
				}
		}

		function onTouchStart(e) {
				if (e.touches.length == 1) {
						startPosX = e.touches[0].pageX;
						startPosY = e.touches[0].pageY;
						isMoving = true;
						startTime = new Date().getTime();
						this.addEventListener('touchmove', onTouchMove, false);
						this.addEventListener('touchend', onTouchEnd, false);
				}
		}

		function init() {
				this.addEventListener && this.addEventListener('touchstart', onTouchStart, false);
		}

		function teardown() {
				this.removeEventListener('touchstart', onTouchStart);
		}

		$.event.special.swipe = { setup: init };

		$.each(['left', 'up', 'down', 'right'], function () {
				$.event.special[`swipe${this}`] = { setup: function () {
								$(this).on('swipe', $.noop);
						} };
		});
})(jQuery);
/****************************************************
 * Method for adding psuedo drag events to elements *
 ***************************************************/
!function ($) {
		$.fn.addTouch = function () {
				this.each(function (i, el) {
						$(el).bind('touchstart touchmove touchend touchcancel', function () {
								//we pass the original event object because the jQuery event
								//object is normalized to w3c specs and does not provide the TouchList
								handleTouch(event);
						});
				});

				var handleTouch = function (event) {
						var touches = event.changedTouches,
						    first = touches[0],
						    eventTypes = {
								touchstart: 'mousedown',
								touchmove: 'mousemove',
								touchend: 'mouseup'
						},
						    type = eventTypes[event.type],
						    simulatedEvent;

						if ('MouseEvent' in window && typeof window.MouseEvent === 'function') {
								simulatedEvent = new window.MouseEvent(type, {
										'bubbles': true,
										'cancelable': true,
										'screenX': first.screenX,
										'screenY': first.screenY,
										'clientX': first.clientX,
										'clientY': first.clientY
								});
						} else {
								simulatedEvent = document.createEvent('MouseEvent');
								simulatedEvent.initMouseEvent(type, true, true, window, 1, first.screenX, first.screenY, first.clientX, first.clientY, false, false, false, false, 0 /*left*/, null);
						}
						first.target.dispatchEvent(simulatedEvent);
				};
		};
}(jQuery);

//**********************************
//**From the jQuery Mobile Library**
//**need to recreate functionality**
//**and try to improve if possible**
//**********************************

/* Removing the jQuery function ****
************************************

(function( $, window, undefined ) {

	var $document = $( document ),
		// supportTouch = $.mobile.support.touch,
		touchStartEvent = 'touchstart'//supportTouch ? "touchstart" : "mousedown",
		touchStopEvent = 'touchend'//supportTouch ? "touchend" : "mouseup",
		touchMoveEvent = 'touchmove'//supportTouch ? "touchmove" : "mousemove";

	// setup new event shortcuts
	$.each( ( "touchstart touchmove touchend " +
		"swipe swipeleft swiperight" ).split( " " ), function( i, name ) {

		$.fn[ name ] = function( fn ) {
			return fn ? this.bind( name, fn ) : this.trigger( name );
		};

		// jQuery < 1.8
		if ( $.attrFn ) {
			$.attrFn[ name ] = true;
		}
	});

	function triggerCustomEvent( obj, eventType, event, bubble ) {
		var originalType = event.type;
		event.type = eventType;
		if ( bubble ) {
			$.event.trigger( event, undefined, obj );
		} else {
			$.event.dispatch.call( obj, event );
		}
		event.type = originalType;
	}

	// also handles taphold

	// Also handles swipeleft, swiperight
	$.event.special.swipe = {

		// More than this horizontal displacement, and we will suppress scrolling.
		scrollSupressionThreshold: 30,

		// More time than this, and it isn't a swipe.
		durationThreshold: 1000,

		// Swipe horizontal displacement must be more than this.
		horizontalDistanceThreshold: window.devicePixelRatio >= 2 ? 15 : 30,

		// Swipe vertical displacement must be less than this.
		verticalDistanceThreshold: window.devicePixelRatio >= 2 ? 15 : 30,

		getLocation: function ( event ) {
			var winPageX = window.pageXOffset,
				winPageY = window.pageYOffset,
				x = event.clientX,
				y = event.clientY;

			if ( event.pageY === 0 && Math.floor( y ) > Math.floor( event.pageY ) ||
				event.pageX === 0 && Math.floor( x ) > Math.floor( event.pageX ) ) {

				// iOS4 clientX/clientY have the value that should have been
				// in pageX/pageY. While pageX/page/ have the value 0
				x = x - winPageX;
				y = y - winPageY;
			} else if ( y < ( event.pageY - winPageY) || x < ( event.pageX - winPageX ) ) {

				// Some Android browsers have totally bogus values for clientX/Y
				// when scrolling/zooming a page. Detectable since clientX/clientY
				// should never be smaller than pageX/pageY minus page scroll
				x = event.pageX - winPageX;
				y = event.pageY - winPageY;
			}

			return {
				x: x,
				y: y
			};
		},

		start: function( event ) {
			var data = event.originalEvent.touches ?
					event.originalEvent.touches[ 0 ] : event,
				location = $.event.special.swipe.getLocation( data );
			return {
						time: ( new Date() ).getTime(),
						coords: [ location.x, location.y ],
						origin: $( event.target )
					};
		},

		stop: function( event ) {
			var data = event.originalEvent.touches ?
					event.originalEvent.touches[ 0 ] : event,
				location = $.event.special.swipe.getLocation( data );
			return {
						time: ( new Date() ).getTime(),
						coords: [ location.x, location.y ]
					};
		},

		handleSwipe: function( start, stop, thisObject, origTarget ) {
			if ( stop.time - start.time < $.event.special.swipe.durationThreshold &&
				Math.abs( start.coords[ 0 ] - stop.coords[ 0 ] ) > $.event.special.swipe.horizontalDistanceThreshold &&
				Math.abs( start.coords[ 1 ] - stop.coords[ 1 ] ) < $.event.special.swipe.verticalDistanceThreshold ) {
				var direction = start.coords[0] > stop.coords[ 0 ] ? "swipeleft" : "swiperight";

				triggerCustomEvent( thisObject, "swipe", $.Event( "swipe", { target: origTarget, swipestart: start, swipestop: stop }), true );
				triggerCustomEvent( thisObject, direction,$.Event( direction, { target: origTarget, swipestart: start, swipestop: stop } ), true );
				return true;
			}
			return false;

		},

		// This serves as a flag to ensure that at most one swipe event event is
		// in work at any given time
		eventInProgress: false,

		setup: function() {
			var events,
				thisObject = this,
				$this = $( thisObject ),
				context = {};

			// Retrieve the events data for this element and add the swipe context
			events = $.data( this, "mobile-events" );
			if ( !events ) {
				events = { length: 0 };
				$.data( this, "mobile-events", events );
			}
			events.length++;
			events.swipe = context;

			context.start = function( event ) {

				// Bail if we're already working on a swipe event
				if ( $.event.special.swipe.eventInProgress ) {
					return;
				}
				$.event.special.swipe.eventInProgress = true;

				var stop,
					start = $.event.special.swipe.start( event ),
					origTarget = event.target,
					emitted = false;

				context.move = function( event ) {
					if ( !start || event.isDefaultPrevented() ) {
						return;
					}

					stop = $.event.special.swipe.stop( event );
					if ( !emitted ) {
						emitted = $.event.special.swipe.handleSwipe( start, stop, thisObject, origTarget );
						if ( emitted ) {

							// Reset the context to make way for the next swipe event
							$.event.special.swipe.eventInProgress = false;
						}
					}
					// prevent scrolling
					if ( Math.abs( start.coords[ 0 ] - stop.coords[ 0 ] ) > $.event.special.swipe.scrollSupressionThreshold ) {
						event.preventDefault();
					}
				};

				context.stop = function() {
						emitted = true;

						// Reset the context to make way for the next swipe event
						$.event.special.swipe.eventInProgress = false;
						$document.off( touchMoveEvent, context.move );
						context.move = null;
				};

				$document.on( touchMoveEvent, context.move )
					.one( touchStopEvent, context.stop );
			};
			$this.on( touchStartEvent, context.start );
		},

		teardown: function() {
			var events, context;

			events = $.data( this, "mobile-events" );
			if ( events ) {
				context = events.swipe;
				delete events.swipe;
				events.length--;
				if ( events.length === 0 ) {
					$.removeData( this, "mobile-events" );
				}
			}

			if ( context ) {
				if ( context.start ) {
					$( this ).off( touchStartEvent, context.start );
				}
				if ( context.move ) {
					$document.off( touchMoveEvent, context.move );
				}
				if ( context.stop ) {
					$document.off( touchStopEvent, context.stop );
				}
			}
		}
	};
	$.each({
		swipeleft: "swipe.left",
		swiperight: "swipe.right"
	}, function( event, sourceEvent ) {

		$.event.special[ event ] = {
			setup: function() {
				$( this ).bind( sourceEvent, $.noop );
			},
			teardown: function() {
				$( this ).unbind( sourceEvent );
			}
		};
	});
})( jQuery, this );
*/
;'use strict';

!function ($) {

  const MutationObserver = function () {
    var prefixes = ['WebKit', 'Moz', 'O', 'Ms', ''];
    for (var i = 0; i < prefixes.length; i++) {
      if (`${prefixes[i]}MutationObserver` in window) {
        return window[`${prefixes[i]}MutationObserver`];
      }
    }
    return false;
  }();

  const triggers = (el, type) => {
    el.data(type).split(' ').forEach(id => {
      $(`#${id}`)[type === 'close' ? 'trigger' : 'triggerHandler'](`${type}.zf.trigger`, [el]);
    });
  };
  // Elements with [data-open] will reveal a plugin that supports it when clicked.
  $(document).on('click.zf.trigger', '[data-open]', function () {
    triggers($(this), 'open');
  });

  // Elements with [data-close] will close a plugin that supports it when clicked.
  // If used without a value on [data-close], the event will bubble, allowing it to close a parent component.
  $(document).on('click.zf.trigger', '[data-close]', function () {
    let id = $(this).data('close');
    if (id) {
      triggers($(this), 'close');
    } else {
      $(this).trigger('close.zf.trigger');
    }
  });

  // Elements with [data-toggle] will toggle a plugin that supports it when clicked.
  $(document).on('click.zf.trigger', '[data-toggle]', function () {
    let id = $(this).data('toggle');
    if (id) {
      triggers($(this), 'toggle');
    } else {
      $(this).trigger('toggle.zf.trigger');
    }
  });

  // Elements with [data-closable] will respond to close.zf.trigger events.
  $(document).on('close.zf.trigger', '[data-closable]', function (e) {
    e.stopPropagation();
    let animation = $(this).data('closable');

    if (animation !== '') {
      Foundation.Motion.animateOut($(this), animation, function () {
        $(this).trigger('closed.zf');
      });
    } else {
      $(this).fadeOut().trigger('closed.zf');
    }
  });

  $(document).on('focus.zf.trigger blur.zf.trigger', '[data-toggle-focus]', function () {
    let id = $(this).data('toggle-focus');
    $(`#${id}`).triggerHandler('toggle.zf.trigger', [$(this)]);
  });

  /**
  * Fires once after all other scripts have loaded
  * @function
  * @private
  */
  $(window).on('load', () => {
    checkListeners();
  });

  function checkListeners() {
    eventsListener();
    resizeListener();
    scrollListener();
    mutateListener();
    closemeListener();
  }

  //******** only fires this function once on load, if there's something to watch ********
  function closemeListener(pluginName) {
    var yetiBoxes = $('[data-yeti-box]'),
        plugNames = ['dropdown', 'tooltip', 'reveal'];

    if (pluginName) {
      if (typeof pluginName === 'string') {
        plugNames.push(pluginName);
      } else if (typeof pluginName === 'object' && typeof pluginName[0] === 'string') {
        plugNames.concat(pluginName);
      } else {
        console.error('Plugin names must be strings');
      }
    }
    if (yetiBoxes.length) {
      let listeners = plugNames.map(name => {
        return `closeme.zf.${name}`;
      }).join(' ');

      $(window).off(listeners).on(listeners, function (e, pluginId) {
        let plugin = e.namespace.split('.')[0];
        let plugins = $(`[data-${plugin}]`).not(`[data-yeti-box="${pluginId}"]`);

        plugins.each(function () {
          let _this = $(this);

          _this.triggerHandler('close.zf.trigger', [_this]);
        });
      });
    }
  }

  function resizeListener(debounce) {
    let timer,
        $nodes = $('[data-resize]');
    if ($nodes.length) {
      $(window).off('resize.zf.trigger').on('resize.zf.trigger', function (e) {
        if (timer) {
          clearTimeout(timer);
        }

        timer = setTimeout(function () {

          if (!MutationObserver) {
            //fallback for IE 9
            $nodes.each(function () {
              $(this).triggerHandler('resizeme.zf.trigger');
            });
          }
          //trigger all listening elements and signal a resize event
          $nodes.attr('data-events', "resize");
        }, debounce || 10); //default time to emit resize event
      });
    }
  }

  function scrollListener(debounce) {
    let timer,
        $nodes = $('[data-scroll]');
    if ($nodes.length) {
      $(window).off('scroll.zf.trigger').on('scroll.zf.trigger', function (e) {
        if (timer) {
          clearTimeout(timer);
        }

        timer = setTimeout(function () {

          if (!MutationObserver) {
            //fallback for IE 9
            $nodes.each(function () {
              $(this).triggerHandler('scrollme.zf.trigger');
            });
          }
          //trigger all listening elements and signal a scroll event
          $nodes.attr('data-events', "scroll");
        }, debounce || 10); //default time to emit scroll event
      });
    }
  }

  function mutateListener(debounce) {
    let $nodes = $('[data-mutate]');
    if ($nodes.length && MutationObserver) {
      //trigger all listening elements and signal a mutate event
      //no IE 9 or 10
      $nodes.each(function () {
        $(this).triggerHandler('mutateme.zf.trigger');
      });
    }
  }

  function eventsListener() {
    if (!MutationObserver) {
      return false;
    }
    let nodes = document.querySelectorAll('[data-resize], [data-scroll], [data-mutate]');

    //element callback
    var listeningElementsMutation = function (mutationRecordsList) {
      var $target = $(mutationRecordsList[0].target);

      //trigger the event handler for the element depending on type
      switch (mutationRecordsList[0].type) {

        case "attributes":
          if ($target.attr("data-events") === "scroll" && mutationRecordsList[0].attributeName === "data-events") {
            $target.triggerHandler('scrollme.zf.trigger', [$target, window.pageYOffset]);
          }
          if ($target.attr("data-events") === "resize" && mutationRecordsList[0].attributeName === "data-events") {
            $target.triggerHandler('resizeme.zf.trigger', [$target]);
          }
          if (mutationRecordsList[0].attributeName === "style") {
            $target.closest("[data-mutate]").attr("data-events", "mutate");
            $target.closest("[data-mutate]").triggerHandler('mutateme.zf.trigger', [$target.closest("[data-mutate]")]);
          }
          break;

        case "childList":
          $target.closest("[data-mutate]").attr("data-events", "mutate");
          $target.closest("[data-mutate]").triggerHandler('mutateme.zf.trigger', [$target.closest("[data-mutate]")]);
          break;

        default:
          return false;
        //nothing
      }
    };

    if (nodes.length) {
      //for each element that needs to listen for resizing, scrolling, or mutation add a single observer
      for (var i = 0; i <= nodes.length - 1; i++) {
        var elementObserver = new MutationObserver(listeningElementsMutation);
        elementObserver.observe(nodes[i], { attributes: true, childList: true, characterData: false, subtree: true, attributeFilter: ["data-events", "style"] });
      }
    }
  }

  // ------------------------------------

  // [PH]
  // Foundation.CheckWatchers = checkWatchers;
  Foundation.IHearYou = checkListeners;
  // Foundation.ISeeYou = scrollListener;
  // Foundation.IFeelYou = closemeListener;
}(jQuery);

// function domMutationObserver(debounce) {
//   // !!! This is coming soon and needs more work; not active  !!! //
//   var timer,
//   nodes = document.querySelectorAll('[data-mutate]');
//   //
//   if (nodes.length) {
//     // var MutationObserver = (function () {
//     //   var prefixes = ['WebKit', 'Moz', 'O', 'Ms', ''];
//     //   for (var i=0; i < prefixes.length; i++) {
//     //     if (prefixes[i] + 'MutationObserver' in window) {
//     //       return window[prefixes[i] + 'MutationObserver'];
//     //     }
//     //   }
//     //   return false;
//     // }());
//
//
//     //for the body, we need to listen for all changes effecting the style and class attributes
//     var bodyObserver = new MutationObserver(bodyMutation);
//     bodyObserver.observe(document.body, { attributes: true, childList: true, characterData: false, subtree:true, attributeFilter:["style", "class"]});
//
//
//     //body callback
//     function bodyMutation(mutate) {
//       //trigger all listening elements and signal a mutation event
//       if (timer) { clearTimeout(timer); }
//
//       timer = setTimeout(function() {
//         bodyObserver.disconnect();
//         $('[data-mutate]').attr('data-events',"mutate");
//       }, debounce || 150);
//     }
//   }
// }
;'use strict';

!function ($) {

  /**
   * Abide module.
   * @module foundation.abide
   */

  class Abide {
    /**
     * Creates a new instance of Abide.
     * @class
     * @fires Abide#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options = {}) {
      this.$element = element;
      this.options = $.extend({}, Abide.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Abide');
    }

    /**
     * Initializes the Abide plugin and calls functions to get Abide functioning on load.
     * @private
     */
    _init() {
      this.$inputs = this.$element.find('input, textarea, select');

      this._events();
    }

    /**
     * Initializes events for Abide.
     * @private
     */
    _events() {
      this.$element.off('.abide').on('reset.zf.abide', () => {
        this.resetForm();
      }).on('submit.zf.abide', () => {
        return this.validateForm();
      });

      if (this.options.validateOn === 'fieldChange') {
        this.$inputs.off('change.zf.abide').on('change.zf.abide', e => {
          this.validateInput($(e.target));
        });
      }

      if (this.options.liveValidate) {
        this.$inputs.off('input.zf.abide').on('input.zf.abide', e => {
          this.validateInput($(e.target));
        });
      }

      if (this.options.validateOnBlur) {
        this.$inputs.off('blur.zf.abide').on('blur.zf.abide', e => {
          this.validateInput($(e.target));
        });
      }
    }

    /**
     * Calls necessary functions to update Abide upon DOM change
     * @private
     */
    _reflow() {
      this._init();
    }

    /**
     * Checks whether or not a form element has the required attribute and if it's checked or not
     * @param {Object} element - jQuery object to check for required attribute
     * @returns {Boolean} Boolean value depends on whether or not attribute is checked or empty
     */
    requiredCheck($el) {
      if (!$el.attr('required')) return true;

      var isGood = true;

      switch ($el[0].type) {
        case 'checkbox':
          isGood = $el[0].checked;
          break;

        case 'select':
        case 'select-one':
        case 'select-multiple':
          var opt = $el.find('option:selected');
          if (!opt.length || !opt.val()) isGood = false;
          break;

        default:
          if (!$el.val() || !$el.val().length) isGood = false;
      }

      return isGood;
    }

    /**
     * Based on $el, get the first element with selector in this order:
     * 1. The element's direct sibling('s).
     * 3. The element's parent's children.
     *
     * This allows for multiple form errors per input, though if none are found, no form errors will be shown.
     *
     * @param {Object} $el - jQuery object to use as reference to find the form error selector.
     * @returns {Object} jQuery object with the selector.
     */
    findFormError($el) {
      var $error = $el.siblings(this.options.formErrorSelector);

      if (!$error.length) {
        $error = $el.parent().find(this.options.formErrorSelector);
      }

      return $error;
    }

    /**
     * Get the first element in this order:
     * 2. The <label> with the attribute `[for="someInputId"]`
     * 3. The `.closest()` <label>
     *
     * @param {Object} $el - jQuery object to check for required attribute
     * @returns {Boolean} Boolean value depends on whether or not attribute is checked or empty
     */
    findLabel($el) {
      var id = $el[0].id;
      var $label = this.$element.find(`label[for="${id}"]`);

      if (!$label.length) {
        return $el.closest('label');
      }

      return $label;
    }

    /**
     * Get the set of labels associated with a set of radio els in this order
     * 2. The <label> with the attribute `[for="someInputId"]`
     * 3. The `.closest()` <label>
     *
     * @param {Object} $el - jQuery object to check for required attribute
     * @returns {Boolean} Boolean value depends on whether or not attribute is checked or empty
     */
    findRadioLabels($els) {
      var labels = $els.map((i, el) => {
        var id = el.id;
        var $label = this.$element.find(`label[for="${id}"]`);

        if (!$label.length) {
          $label = $(el).closest('label');
        }
        return $label[0];
      });

      return $(labels);
    }

    /**
     * Adds the CSS error class as specified by the Abide settings to the label, input, and the form
     * @param {Object} $el - jQuery object to add the class to
     */
    addErrorClasses($el) {
      var $label = this.findLabel($el);
      var $formError = this.findFormError($el);

      if ($label.length) {
        $label.addClass(this.options.labelErrorClass);
      }

      if ($formError.length) {
        $formError.addClass(this.options.formErrorClass);
      }

      $el.addClass(this.options.inputErrorClass).attr('data-invalid', '');
    }

    /**
     * Remove CSS error classes etc from an entire radio button group
     * @param {String} groupName - A string that specifies the name of a radio button group
     *
     */

    removeRadioErrorClasses(groupName) {
      var $els = this.$element.find(`:radio[name="${groupName}"]`);
      var $labels = this.findRadioLabels($els);
      var $formErrors = this.findFormError($els);

      if ($labels.length) {
        $labels.removeClass(this.options.labelErrorClass);
      }

      if ($formErrors.length) {
        $formErrors.removeClass(this.options.formErrorClass);
      }

      $els.removeClass(this.options.inputErrorClass).removeAttr('data-invalid');
    }

    /**
     * Removes CSS error class as specified by the Abide settings from the label, input, and the form
     * @param {Object} $el - jQuery object to remove the class from
     */
    removeErrorClasses($el) {
      // radios need to clear all of the els
      if ($el[0].type == 'radio') {
        return this.removeRadioErrorClasses($el.attr('name'));
      }

      var $label = this.findLabel($el);
      var $formError = this.findFormError($el);

      if ($label.length) {
        $label.removeClass(this.options.labelErrorClass);
      }

      if ($formError.length) {
        $formError.removeClass(this.options.formErrorClass);
      }

      $el.removeClass(this.options.inputErrorClass).removeAttr('data-invalid');
    }

    /**
     * Goes through a form to find inputs and proceeds to validate them in ways specific to their type
     * @fires Abide#invalid
     * @fires Abide#valid
     * @param {Object} element - jQuery object to validate, should be an HTML input
     * @returns {Boolean} goodToGo - If the input is valid or not.
     */
    validateInput($el) {
      var clearRequire = this.requiredCheck($el),
          validated = false,
          customValidator = true,
          validator = $el.attr('data-validator'),
          equalTo = true;

      // don't validate ignored inputs or hidden inputs
      if ($el.is('[data-abide-ignore]') || $el.is('[type="hidden"]')) {
        return true;
      }

      switch ($el[0].type) {
        case 'radio':
          validated = this.validateRadio($el.attr('name'));
          break;

        case 'checkbox':
          validated = clearRequire;
          break;

        case 'select':
        case 'select-one':
        case 'select-multiple':
          validated = clearRequire;
          break;

        default:
          validated = this.validateText($el);
      }

      if (validator) {
        customValidator = this.matchValidation($el, validator, $el.attr('required'));
      }

      if ($el.attr('data-equalto')) {
        equalTo = this.options.validators.equalTo($el);
      }

      var goodToGo = [clearRequire, validated, customValidator, equalTo].indexOf(false) === -1;
      var message = (goodToGo ? 'valid' : 'invalid') + '.zf.abide';

      if (goodToGo) {
        // Re-validate inputs that depend on this one with equalto
        const dependentElements = this.$element.find(`[data-equalto="${$el.attr('id')}"]`);
        if (dependentElements.length) {
          let _this = this;
          dependentElements.each(function () {
            if ($(this).val()) {
              _this.validateInput($(this));
            }
          });
        }
      }

      this[goodToGo ? 'removeErrorClasses' : 'addErrorClasses']($el);

      /**
       * Fires when the input is done checking for validation. Event trigger is either `valid.zf.abide` or `invalid.zf.abide`
       * Trigger includes the DOM element of the input.
       * @event Abide#valid
       * @event Abide#invalid
       */
      $el.trigger(message, [$el]);

      return goodToGo;
    }

    /**
     * Goes through a form and if there are any invalid inputs, it will display the form error element
     * @returns {Boolean} noError - true if no errors were detected...
     * @fires Abide#formvalid
     * @fires Abide#forminvalid
     */
    validateForm() {
      var acc = [];
      var _this = this;

      this.$inputs.each(function () {
        acc.push(_this.validateInput($(this)));
      });

      var noError = acc.indexOf(false) === -1;

      this.$element.find('[data-abide-error]').css('display', noError ? 'none' : 'block');

      /**
       * Fires when the form is finished validating. Event trigger is either `formvalid.zf.abide` or `forminvalid.zf.abide`.
       * Trigger includes the element of the form.
       * @event Abide#formvalid
       * @event Abide#forminvalid
       */
      this.$element.trigger((noError ? 'formvalid' : 'forminvalid') + '.zf.abide', [this.$element]);

      return noError;
    }

    /**
     * Determines whether or a not a text input is valid based on the pattern specified in the attribute. If no matching pattern is found, returns true.
     * @param {Object} $el - jQuery object to validate, should be a text input HTML element
     * @param {String} pattern - string value of one of the RegEx patterns in Abide.options.patterns
     * @returns {Boolean} Boolean value depends on whether or not the input value matches the pattern specified
     */
    validateText($el, pattern) {
      // A pattern can be passed to this function, or it will be infered from the input's "pattern" attribute, or it's "type" attribute
      pattern = pattern || $el.attr('pattern') || $el.attr('type');
      var inputText = $el.val();
      var valid = false;

      if (inputText.length) {
        // If the pattern attribute on the element is in Abide's list of patterns, then test that regexp
        if (this.options.patterns.hasOwnProperty(pattern)) {
          valid = this.options.patterns[pattern].test(inputText);
        }
        // If the pattern name isn't also the type attribute of the field, then test it as a regexp
        else if (pattern !== $el.attr('type')) {
            valid = new RegExp(pattern).test(inputText);
          } else {
            valid = true;
          }
      }
      // An empty field is valid if it's not required
      else if (!$el.prop('required')) {
          valid = true;
        }

      return valid;
    }

    /**
     * Determines whether or a not a radio input is valid based on whether or not it is required and selected. Although the function targets a single `<input>`, it validates by checking the `required` and `checked` properties of all radio buttons in its group.
     * @param {String} groupName - A string that specifies the name of a radio button group
     * @returns {Boolean} Boolean value depends on whether or not at least one radio input has been selected (if it's required)
     */
    validateRadio(groupName) {
      // If at least one radio in the group has the `required` attribute, the group is considered required
      // Per W3C spec, all radio buttons in a group should have `required`, but we're being nice
      var $group = this.$element.find(`:radio[name="${groupName}"]`);
      var valid = false,
          required = false;

      // For the group to be required, at least one radio needs to be required
      $group.each((i, e) => {
        if ($(e).attr('required')) {
          required = true;
        }
      });
      if (!required) valid = true;

      if (!valid) {
        // For the group to be valid, at least one radio needs to be checked
        $group.each((i, e) => {
          if ($(e).prop('checked')) {
            valid = true;
          }
        });
      };

      return valid;
    }

    /**
     * Determines if a selected input passes a custom validation function. Multiple validations can be used, if passed to the element with `data-validator="foo bar baz"` in a space separated listed.
     * @param {Object} $el - jQuery input element.
     * @param {String} validators - a string of function names matching functions in the Abide.options.validators object.
     * @param {Boolean} required - self explanatory?
     * @returns {Boolean} - true if validations passed.
     */
    matchValidation($el, validators, required) {
      required = required ? true : false;

      var clear = validators.split(' ').map(v => {
        return this.options.validators[v]($el, required, $el.parent());
      });
      return clear.indexOf(false) === -1;
    }

    /**
     * Resets form inputs and styles
     * @fires Abide#formreset
     */
    resetForm() {
      var $form = this.$element,
          opts = this.options;

      $(`.${opts.labelErrorClass}`, $form).not('small').removeClass(opts.labelErrorClass);
      $(`.${opts.inputErrorClass}`, $form).not('small').removeClass(opts.inputErrorClass);
      $(`${opts.formErrorSelector}.${opts.formErrorClass}`).removeClass(opts.formErrorClass);
      $form.find('[data-abide-error]').css('display', 'none');
      $(':input', $form).not(':button, :submit, :reset, :hidden, :radio, :checkbox, [data-abide-ignore]').val('').removeAttr('data-invalid');
      $(':input:radio', $form).not('[data-abide-ignore]').prop('checked', false).removeAttr('data-invalid');
      $(':input:checkbox', $form).not('[data-abide-ignore]').prop('checked', false).removeAttr('data-invalid');
      /**
       * Fires when the form has been reset.
       * @event Abide#formreset
       */
      $form.trigger('formreset.zf.abide', [$form]);
    }

    /**
     * Destroys an instance of Abide.
     * Removes error styles and classes from elements, without resetting their values.
     */
    destroy() {
      var _this = this;
      this.$element.off('.abide').find('[data-abide-error]').css('display', 'none');

      this.$inputs.off('.abide').each(function () {
        _this.removeErrorClasses($(this));
      });

      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  Abide.defaults = {
    /**
     * The default event to validate inputs. Checkboxes and radios validate immediately.
     * Remove or change this value for manual validation.
     * @option
     * @example 'fieldChange'
     */
    validateOn: 'fieldChange',

    /**
     * Class to be applied to input labels on failed validation.
     * @option
     * @example 'is-invalid-label'
     */
    labelErrorClass: 'is-invalid-label',

    /**
     * Class to be applied to inputs on failed validation.
     * @option
     * @example 'is-invalid-input'
     */
    inputErrorClass: 'is-invalid-input',

    /**
     * Class selector to use to target Form Errors for show/hide.
     * @option
     * @example '.form-error'
     */
    formErrorSelector: '.form-error',

    /**
     * Class added to Form Errors on failed validation.
     * @option
     * @example 'is-visible'
     */
    formErrorClass: 'is-visible',

    /**
     * Set to true to validate text inputs on any value change.
     * @option
     * @example false
     */
    liveValidate: false,

    /**
     * Set to true to validate inputs on blur.
     * @option
     * @example false
     */
    validateOnBlur: false,

    patterns: {
      alpha: /^[a-zA-Z]+$/,
      alpha_numeric: /^[a-zA-Z0-9]+$/,
      integer: /^[-+]?\d+$/,
      number: /^[-+]?\d*(?:[\.\,]\d+)?$/,

      // amex, visa, diners
      card: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/,
      cvv: /^([0-9]){3,4}$/,

      // http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#valid-e-mail-address
      email: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,

      url: /^(https?|ftp|file|ssh):\/\/(((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/,
      // abc.de
      domain: /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,8}$/,

      datetime: /^([0-2][0-9]{3})\-([0-1][0-9])\-([0-3][0-9])T([0-5][0-9])\:([0-5][0-9])\:([0-5][0-9])(Z|([\-\+]([0-1][0-9])\:00))$/,
      // YYYY-MM-DD
      date: /(?:19|20)[0-9]{2}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-9])|(?:(?!02)(?:0[1-9]|1[0-2])-(?:30))|(?:(?:0[13578]|1[02])-31))$/,
      // HH:MM:SS
      time: /^(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}$/,
      dateISO: /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,
      // MM/DD/YYYY
      month_day_year: /^(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.]\d{4}$/,
      // DD/MM/YYYY
      day_month_year: /^(0[1-9]|[12][0-9]|3[01])[- \/.](0[1-9]|1[012])[- \/.]\d{4}$/,

      // #FFF or #FFFFFF
      color: /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/
    },

    /**
     * Optional validation functions to be used. `equalTo` being the only default included function.
     * Functions should return only a boolean if the input is valid or not. Functions are given the following arguments:
     * el : The jQuery element to validate.
     * required : Boolean value of the required attribute be present or not.
     * parent : The direct parent of the input.
     * @option
     */
    validators: {
      equalTo: function (el, required, parent) {
        return $(`#${el.attr('data-equalto')}`).val() === el.val();
      }
    }
  };

  // Window exports
  Foundation.plugin(Abide, 'Abide');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Accordion module.
   * @module foundation.accordion
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   */

  class Accordion {
    /**
     * Creates a new instance of an accordion.
     * @class
     * @fires Accordion#init
     * @param {jQuery} element - jQuery object to make into an accordion.
     * @param {Object} options - a plain object with settings to override the default options.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Accordion.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Accordion');
      Foundation.Keyboard.register('Accordion', {
        'ENTER': 'toggle',
        'SPACE': 'toggle',
        'ARROW_DOWN': 'next',
        'ARROW_UP': 'previous'
      });
    }

    /**
     * Initializes the accordion by animating the preset active pane(s).
     * @private
     */
    _init() {
      this.$element.attr('role', 'tablist');
      this.$tabs = this.$element.children('[data-accordion-item]');

      this.$tabs.each(function (idx, el) {
        var $el = $(el),
            $content = $el.children('[data-tab-content]'),
            id = $content[0].id || Foundation.GetYoDigits(6, 'accordion'),
            linkId = el.id || `${id}-label`;

        $el.find('a:first').attr({
          'aria-controls': id,
          'role': 'tab',
          'id': linkId,
          'aria-expanded': false,
          'aria-selected': false
        });

        $content.attr({ 'role': 'tabpanel', 'aria-labelledby': linkId, 'aria-hidden': true, 'id': id });
      });
      var $initActive = this.$element.find('.is-active').children('[data-tab-content]');
      if ($initActive.length) {
        this.down($initActive, true);
      }
      this._events();
    }

    /**
     * Adds event handlers for items within the accordion.
     * @private
     */
    _events() {
      var _this = this;

      this.$tabs.each(function () {
        var $elem = $(this);
        var $tabContent = $elem.children('[data-tab-content]');
        if ($tabContent.length) {
          $elem.children('a').off('click.zf.accordion keydown.zf.accordion').on('click.zf.accordion', function (e) {
            e.preventDefault();
            _this.toggle($tabContent);
          }).on('keydown.zf.accordion', function (e) {
            Foundation.Keyboard.handleKey(e, 'Accordion', {
              toggle: function () {
                _this.toggle($tabContent);
              },
              next: function () {
                var $a = $elem.next().find('a').focus();
                if (!_this.options.multiExpand) {
                  $a.trigger('click.zf.accordion');
                }
              },
              previous: function () {
                var $a = $elem.prev().find('a').focus();
                if (!_this.options.multiExpand) {
                  $a.trigger('click.zf.accordion');
                }
              },
              handled: function () {
                e.preventDefault();
                e.stopPropagation();
              }
            });
          });
        }
      });
    }

    /**
     * Toggles the selected content pane's open/close state.
     * @param {jQuery} $target - jQuery object of the pane to toggle (`.accordion-content`).
     * @function
     */
    toggle($target) {
      if ($target.parent().hasClass('is-active')) {
        this.up($target);
      } else {
        this.down($target);
      }
    }

    /**
     * Opens the accordion tab defined by `$target`.
     * @param {jQuery} $target - Accordion pane to open (`.accordion-content`).
     * @param {Boolean} firstTime - flag to determine if reflow should happen.
     * @fires Accordion#down
     * @function
     */
    down($target, firstTime) {
      $target.attr('aria-hidden', false).parent('[data-tab-content]').addBack().parent().addClass('is-active');

      if (!this.options.multiExpand && !firstTime) {
        var $currentActive = this.$element.children('.is-active').children('[data-tab-content]');
        if ($currentActive.length) {
          this.up($currentActive.not($target));
        }
      }

      $target.slideDown(this.options.slideSpeed, () => {
        /**
         * Fires when the tab is done opening.
         * @event Accordion#down
         */
        this.$element.trigger('down.zf.accordion', [$target]);
      });

      $(`#${$target.attr('aria-labelledby')}`).attr({
        'aria-expanded': true,
        'aria-selected': true
      });
    }

    /**
     * Closes the tab defined by `$target`.
     * @param {jQuery} $target - Accordion tab to close (`.accordion-content`).
     * @fires Accordion#up
     * @function
     */
    up($target) {
      var $aunts = $target.parent().siblings(),
          _this = this;

      if (!this.options.allowAllClosed && !$aunts.hasClass('is-active') || !$target.parent().hasClass('is-active')) {
        return;
      }

      // Foundation.Move(this.options.slideSpeed, $target, function(){
      $target.slideUp(_this.options.slideSpeed, function () {
        /**
         * Fires when the tab is done collapsing up.
         * @event Accordion#up
         */
        _this.$element.trigger('up.zf.accordion', [$target]);
      });
      // });

      $target.attr('aria-hidden', true).parent().removeClass('is-active');

      $(`#${$target.attr('aria-labelledby')}`).attr({
        'aria-expanded': false,
        'aria-selected': false
      });
    }

    /**
     * Destroys an instance of an accordion.
     * @fires Accordion#destroyed
     * @function
     */
    destroy() {
      this.$element.find('[data-tab-content]').stop(true).slideUp(0).css('display', '');
      this.$element.find('a').off('.zf.accordion');

      Foundation.unregisterPlugin(this);
    }
  }

  Accordion.defaults = {
    /**
     * Amount of time to animate the opening of an accordion pane.
     * @option
     * @example 250
     */
    slideSpeed: 250,
    /**
     * Allow the accordion to have multiple open panes.
     * @option
     * @example false
     */
    multiExpand: false,
    /**
     * Allow the accordion to close all panes.
     * @option
     * @example false
     */
    allowAllClosed: false
  };

  // Window exports
  Foundation.plugin(Accordion, 'Accordion');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * AccordionMenu module.
   * @module foundation.accordionMenu
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   * @requires foundation.util.nest
   */

  class AccordionMenu {
    /**
     * Creates a new instance of an accordion menu.
     * @class
     * @fires AccordionMenu#init
     * @param {jQuery} element - jQuery object to make into an accordion menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, AccordionMenu.defaults, this.$element.data(), options);

      Foundation.Nest.Feather(this.$element, 'accordion');

      this._init();

      Foundation.registerPlugin(this, 'AccordionMenu');
      Foundation.Keyboard.register('AccordionMenu', {
        'ENTER': 'toggle',
        'SPACE': 'toggle',
        'ARROW_RIGHT': 'open',
        'ARROW_UP': 'up',
        'ARROW_DOWN': 'down',
        'ARROW_LEFT': 'close',
        'ESCAPE': 'closeAll'
      });
    }

    /**
     * Initializes the accordion menu by hiding all nested menus.
     * @private
     */
    _init() {
      this.$element.find('[data-submenu]').not('.is-active').slideUp(0); //.find('a').css('padding-left', '1rem');
      this.$element.attr({
        'role': 'menu',
        'aria-multiselectable': this.options.multiOpen
      });

      this.$menuLinks = this.$element.find('.is-accordion-submenu-parent');
      this.$menuLinks.each(function () {
        var linkId = this.id || Foundation.GetYoDigits(6, 'acc-menu-link'),
            $elem = $(this),
            $sub = $elem.children('[data-submenu]'),
            subId = $sub[0].id || Foundation.GetYoDigits(6, 'acc-menu'),
            isActive = $sub.hasClass('is-active');
        $elem.attr({
          'aria-controls': subId,
          'aria-expanded': isActive,
          'role': 'menuitem',
          'id': linkId
        });
        $sub.attr({
          'aria-labelledby': linkId,
          'aria-hidden': !isActive,
          'role': 'menu',
          'id': subId
        });
      });
      var initPanes = this.$element.find('.is-active');
      if (initPanes.length) {
        var _this = this;
        initPanes.each(function () {
          _this.down($(this));
        });
      }
      this._events();
    }

    /**
     * Adds event handlers for items within the menu.
     * @private
     */
    _events() {
      var _this = this;

      this.$element.find('li').each(function () {
        var $submenu = $(this).children('[data-submenu]');

        if ($submenu.length) {
          $(this).children('a').off('click.zf.accordionMenu').on('click.zf.accordionMenu', function (e) {
            e.preventDefault();

            _this.toggle($submenu);
          });
        }
      }).on('keydown.zf.accordionmenu', function (e) {
        var $element = $(this),
            $elements = $element.parent('ul').children('li'),
            $prevElement,
            $nextElement,
            $target = $element.children('[data-submenu]');

        $elements.each(function (i) {
          if ($(this).is($element)) {
            $prevElement = $elements.eq(Math.max(0, i - 1)).find('a').first();
            $nextElement = $elements.eq(Math.min(i + 1, $elements.length - 1)).find('a').first();

            if ($(this).children('[data-submenu]:visible').length) {
              // has open sub menu
              $nextElement = $element.find('li:first-child').find('a').first();
            }
            if ($(this).is(':first-child')) {
              // is first element of sub menu
              $prevElement = $element.parents('li').first().find('a').first();
            } else if ($prevElement.parents('li').first().children('[data-submenu]:visible').length) {
              // if previous element has open sub menu
              $prevElement = $prevElement.parents('li').find('li:last-child').find('a').first();
            }
            if ($(this).is(':last-child')) {
              // is last element of sub menu
              $nextElement = $element.parents('li').first().next('li').find('a').first();
            }

            return;
          }
        });

        Foundation.Keyboard.handleKey(e, 'AccordionMenu', {
          open: function () {
            if ($target.is(':hidden')) {
              _this.down($target);
              $target.find('li').first().find('a').first().focus();
            }
          },
          close: function () {
            if ($target.length && !$target.is(':hidden')) {
              // close active sub of this item
              _this.up($target);
            } else if ($element.parent('[data-submenu]').length) {
              // close currently open sub
              _this.up($element.parent('[data-submenu]'));
              $element.parents('li').first().find('a').first().focus();
            }
          },
          up: function () {
            $prevElement.focus();
            return true;
          },
          down: function () {
            $nextElement.focus();
            return true;
          },
          toggle: function () {
            if ($element.children('[data-submenu]').length) {
              _this.toggle($element.children('[data-submenu]'));
            }
          },
          closeAll: function () {
            _this.hideAll();
          },
          handled: function (preventDefault) {
            if (preventDefault) {
              e.preventDefault();
            }
            e.stopImmediatePropagation();
          }
        });
      }); //.attr('tabindex', 0);
    }

    /**
     * Closes all panes of the menu.
     * @function
     */
    hideAll() {
      this.up(this.$element.find('[data-submenu]'));
    }

    /**
     * Opens all panes of the menu.
     * @function
     */
    showAll() {
      this.down(this.$element.find('[data-submenu]'));
    }

    /**
     * Toggles the open/close state of a submenu.
     * @function
     * @param {jQuery} $target - the submenu to toggle
     */
    toggle($target) {
      if (!$target.is(':animated')) {
        if (!$target.is(':hidden')) {
          this.up($target);
        } else {
          this.down($target);
        }
      }
    }

    /**
     * Opens the sub-menu defined by `$target`.
     * @param {jQuery} $target - Sub-menu to open.
     * @fires AccordionMenu#down
     */
    down($target) {
      var _this = this;

      if (!this.options.multiOpen) {
        this.up(this.$element.find('.is-active').not($target.parentsUntil(this.$element).add($target)));
      }

      $target.addClass('is-active').attr({ 'aria-hidden': false }).parent('.is-accordion-submenu-parent').attr({ 'aria-expanded': true });

      //Foundation.Move(this.options.slideSpeed, $target, function() {
      $target.slideDown(_this.options.slideSpeed, function () {
        /**
         * Fires when the menu is done opening.
         * @event AccordionMenu#down
         */
        _this.$element.trigger('down.zf.accordionMenu', [$target]);
      });
      //});
    }

    /**
     * Closes the sub-menu defined by `$target`. All sub-menus inside the target will be closed as well.
     * @param {jQuery} $target - Sub-menu to close.
     * @fires AccordionMenu#up
     */
    up($target) {
      var _this = this;
      //Foundation.Move(this.options.slideSpeed, $target, function(){
      $target.slideUp(_this.options.slideSpeed, function () {
        /**
         * Fires when the menu is done collapsing up.
         * @event AccordionMenu#up
         */
        _this.$element.trigger('up.zf.accordionMenu', [$target]);
      });
      //});

      var $menus = $target.find('[data-submenu]').slideUp(0).addBack().attr('aria-hidden', true);

      $menus.parent('.is-accordion-submenu-parent').attr('aria-expanded', false);
    }

    /**
     * Destroys an instance of accordion menu.
     * @fires AccordionMenu#destroyed
     */
    destroy() {
      this.$element.find('[data-submenu]').slideDown(0).css('display', '');
      this.$element.find('a').off('click.zf.accordionMenu');

      Foundation.Nest.Burn(this.$element, 'accordion');
      Foundation.unregisterPlugin(this);
    }
  }

  AccordionMenu.defaults = {
    /**
     * Amount of time to animate the opening of a submenu in ms.
     * @option
     * @example 250
     */
    slideSpeed: 250,
    /**
     * Allow the menu to have multiple open panes.
     * @option
     * @example true
     */
    multiOpen: true
  };

  // Window exports
  Foundation.plugin(AccordionMenu, 'AccordionMenu');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Drilldown module.
   * @module foundation.drilldown
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   * @requires foundation.util.nest
   */

  class Drilldown {
    /**
     * Creates a new instance of a drilldown menu.
     * @class
     * @param {jQuery} element - jQuery object to make into an accordion menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Drilldown.defaults, this.$element.data(), options);

      Foundation.Nest.Feather(this.$element, 'drilldown');

      this._init();

      Foundation.registerPlugin(this, 'Drilldown');
      Foundation.Keyboard.register('Drilldown', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ARROW_RIGHT': 'next',
        'ARROW_UP': 'up',
        'ARROW_DOWN': 'down',
        'ARROW_LEFT': 'previous',
        'ESCAPE': 'close',
        'TAB': 'down',
        'SHIFT_TAB': 'up'
      });
    }

    /**
     * Initializes the drilldown by creating jQuery collections of elements
     * @private
     */
    _init() {
      this.$submenuAnchors = this.$element.find('li.is-drilldown-submenu-parent').children('a');
      this.$submenus = this.$submenuAnchors.parent('li').children('[data-submenu]');
      this.$menuItems = this.$element.find('li').not('.js-drilldown-back').attr('role', 'menuitem').find('a');
      this.$element.attr('data-mutate', this.$element.attr('data-drilldown') || Foundation.GetYoDigits(6, 'drilldown'));

      this._prepareMenu();
      this._registerEvents();

      this._keyboardEvents();
    }

    /**
     * prepares drilldown menu by setting attributes to links and elements
     * sets a min height to prevent content jumping
     * wraps the element if not already wrapped
     * @private
     * @function
     */
    _prepareMenu() {
      var _this = this;
      // if(!this.options.holdOpen){
      //   this._menuLinkEvents();
      // }
      this.$submenuAnchors.each(function () {
        var $link = $(this);
        var $sub = $link.parent();
        if (_this.options.parentLink) {
          $link.clone().prependTo($sub.children('[data-submenu]')).wrap('<li class="is-submenu-parent-item is-submenu-item is-drilldown-submenu-item" role="menu-item"></li>');
        }
        $link.data('savedHref', $link.attr('href')).removeAttr('href').attr('tabindex', 0);
        $link.children('[data-submenu]').attr({
          'aria-hidden': true,
          'tabindex': 0,
          'role': 'menu'
        });
        _this._events($link);
      });
      this.$submenus.each(function () {
        var $menu = $(this),
            $back = $menu.find('.js-drilldown-back');
        if (!$back.length) {
          switch (_this.options.backButtonPosition) {
            case "bottom":
              $menu.append(_this.options.backButton);
              break;
            case "top":
              $menu.prepend(_this.options.backButton);
              break;
            default:
              console.error("Unsupported backButtonPosition value '" + _this.options.backButtonPosition + "'");
          }
        }
        _this._back($menu);
      });

      if (!this.options.autoHeight) {
        this.$submenus.addClass('drilldown-submenu-cover-previous');
      }

      if (!this.$element.parent().hasClass('is-drilldown')) {
        this.$wrapper = $(this.options.wrapper).addClass('is-drilldown');
        if (this.options.animateHeight) this.$wrapper.addClass('animate-height');
        this.$wrapper = this.$element.wrap(this.$wrapper).parent().css(this._getMaxDims());
      }
    }

    _resize() {
      this.$wrapper.css({ 'max-width': 'none', 'min-height': 'none' });
      // _getMaxDims has side effects (boo) but calling it should update all other necessary heights & widths
      this.$wrapper.css(this._getMaxDims());
    }

    /**
     * Adds event handlers to elements in the menu.
     * @function
     * @private
     * @param {jQuery} $elem - the current menu item to add handlers to.
     */
    _events($elem) {
      var _this = this;

      $elem.off('click.zf.drilldown').on('click.zf.drilldown', function (e) {
        if ($(e.target).parentsUntil('ul', 'li').hasClass('is-drilldown-submenu-parent')) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }

        // if(e.target !== e.currentTarget.firstElementChild){
        //   return false;
        // }
        _this._show($elem.parent('li'));

        if (_this.options.closeOnClick) {
          var $body = $('body');
          $body.off('.zf.drilldown').on('click.zf.drilldown', function (e) {
            if (e.target === _this.$element[0] || $.contains(_this.$element[0], e.target)) {
              return;
            }
            e.preventDefault();
            _this._hideAll();
            $body.off('.zf.drilldown');
          });
        }
      });
      this.$element.on('mutateme.zf.trigger', this._resize.bind(this));
    }

    /**
     * Adds event handlers to the menu element.
     * @function
     * @private
     */
    _registerEvents() {
      if (this.options.scrollTop) {
        this._bindHandler = this._scrollTop.bind(this);
        this.$element.on('open.zf.drilldown hide.zf.drilldown closed.zf.drilldown', this._bindHandler);
      }
    }

    /**
     * Scroll to Top of Element or data-scroll-top-element
     * @function
     * @fires Drilldown#scrollme
     */
    _scrollTop() {
      var _this = this;
      var $scrollTopElement = _this.options.scrollTopElement != '' ? $(_this.options.scrollTopElement) : _this.$element,
          scrollPos = parseInt($scrollTopElement.offset().top + _this.options.scrollTopOffset);
      $('html, body').stop(true).animate({ scrollTop: scrollPos }, _this.options.animationDuration, _this.options.animationEasing, function () {
        /**
          * Fires after the menu has scrolled
          * @event Drilldown#scrollme
          */
        if (this === $('html')[0]) _this.$element.trigger('scrollme.zf.drilldown');
      });
    }

    /**
     * Adds keydown event listener to `li`'s in the menu.
     * @private
     */
    _keyboardEvents() {
      var _this = this;

      this.$menuItems.add(this.$element.find('.js-drilldown-back > a, .is-submenu-parent-item > a')).on('keydown.zf.drilldown', function (e) {
        var $element = $(this),
            $elements = $element.parent('li').parent('ul').children('li').children('a'),
            $prevElement,
            $nextElement;

        $elements.each(function (i) {
          if ($(this).is($element)) {
            $prevElement = $elements.eq(Math.max(0, i - 1));
            $nextElement = $elements.eq(Math.min(i + 1, $elements.length - 1));
            return;
          }
        });

        Foundation.Keyboard.handleKey(e, 'Drilldown', {
          next: function () {
            if ($element.is(_this.$submenuAnchors)) {
              _this._show($element.parent('li'));
              $element.parent('li').one(Foundation.transitionend($element), function () {
                $element.parent('li').find('ul li a').filter(_this.$menuItems).first().focus();
              });
              return true;
            }
          },
          previous: function () {
            _this._hide($element.parent('li').parent('ul'));
            $element.parent('li').parent('ul').one(Foundation.transitionend($element), function () {
              setTimeout(function () {
                $element.parent('li').parent('ul').parent('li').children('a').first().focus();
              }, 1);
            });
            return true;
          },
          up: function () {
            $prevElement.focus();
            return true;
          },
          down: function () {
            $nextElement.focus();
            return true;
          },
          close: function () {
            _this._back();
            //_this.$menuItems.first().focus(); // focus to first element
          },
          open: function () {
            if (!$element.is(_this.$menuItems)) {
              // not menu item means back button
              _this._hide($element.parent('li').parent('ul'));
              $element.parent('li').parent('ul').one(Foundation.transitionend($element), function () {
                setTimeout(function () {
                  $element.parent('li').parent('ul').parent('li').children('a').first().focus();
                }, 1);
              });
              return true;
            } else if ($element.is(_this.$submenuAnchors)) {
              _this._show($element.parent('li'));
              $element.parent('li').one(Foundation.transitionend($element), function () {
                $element.parent('li').find('ul li a').filter(_this.$menuItems).first().focus();
              });
              return true;
            }
          },
          handled: function (preventDefault) {
            if (preventDefault) {
              e.preventDefault();
            }
            e.stopImmediatePropagation();
          }
        });
      }); // end keyboardAccess
    }

    /**
     * Closes all open elements, and returns to root menu.
     * @function
     * @fires Drilldown#closed
     */
    _hideAll() {
      var $elem = this.$element.find('.is-drilldown-submenu.is-active').addClass('is-closing');
      if (this.options.autoHeight) this.$wrapper.css({ height: $elem.parent().closest('ul').data('calcHeight') });
      $elem.one(Foundation.transitionend($elem), function (e) {
        $elem.removeClass('is-active is-closing');
      });
      /**
       * Fires when the menu is fully closed.
       * @event Drilldown#closed
       */
      this.$element.trigger('closed.zf.drilldown');
    }

    /**
     * Adds event listener for each `back` button, and closes open menus.
     * @function
     * @fires Drilldown#back
     * @param {jQuery} $elem - the current sub-menu to add `back` event.
     */
    _back($elem) {
      var _this = this;
      $elem.off('click.zf.drilldown');
      $elem.children('.js-drilldown-back').on('click.zf.drilldown', function (e) {
        e.stopImmediatePropagation();
        // console.log('mouseup on back');
        _this._hide($elem);

        // If there is a parent submenu, call show
        let parentSubMenu = $elem.parent('li').parent('ul').parent('li');
        if (parentSubMenu.length) {
          _this._show(parentSubMenu);
        }
      });
    }

    /**
     * Adds event listener to menu items w/o submenus to close open menus on click.
     * @function
     * @private
     */
    _menuLinkEvents() {
      var _this = this;
      this.$menuItems.not('.is-drilldown-submenu-parent').off('click.zf.drilldown').on('click.zf.drilldown', function (e) {
        // e.stopImmediatePropagation();
        setTimeout(function () {
          _this._hideAll();
        }, 0);
      });
    }

    /**
     * Opens a submenu.
     * @function
     * @fires Drilldown#open
     * @param {jQuery} $elem - the current element with a submenu to open, i.e. the `li` tag.
     */
    _show($elem) {
      if (this.options.autoHeight) this.$wrapper.css({ height: $elem.children('[data-submenu]').data('calcHeight') });
      $elem.attr('aria-expanded', true);
      $elem.children('[data-submenu]').addClass('is-active').attr('aria-hidden', false);
      /**
       * Fires when the submenu has opened.
       * @event Drilldown#open
       */
      this.$element.trigger('open.zf.drilldown', [$elem]);
    }

    /**
     * Hides a submenu
     * @function
     * @fires Drilldown#hide
     * @param {jQuery} $elem - the current sub-menu to hide, i.e. the `ul` tag.
     */
    _hide($elem) {
      if (this.options.autoHeight) this.$wrapper.css({ height: $elem.parent().closest('ul').data('calcHeight') });
      var _this = this;
      $elem.parent('li').attr('aria-expanded', false);
      $elem.attr('aria-hidden', true).addClass('is-closing');
      $elem.addClass('is-closing').one(Foundation.transitionend($elem), function () {
        $elem.removeClass('is-active is-closing');
        $elem.blur();
      });
      /**
       * Fires when the submenu has closed.
       * @event Drilldown#hide
       */
      $elem.trigger('hide.zf.drilldown', [$elem]);
    }

    /**
     * Iterates through the nested menus to calculate the min-height, and max-width for the menu.
     * Prevents content jumping.
     * @function
     * @private
     */
    _getMaxDims() {
      var maxHeight = 0,
          result = {},
          _this = this;
      this.$submenus.add(this.$element).each(function () {
        var numOfElems = $(this).children('li').length;
        var height = Foundation.Box.GetDimensions(this).height;
        maxHeight = height > maxHeight ? height : maxHeight;
        if (_this.options.autoHeight) {
          $(this).data('calcHeight', height);
          if (!$(this).hasClass('is-drilldown-submenu')) result['height'] = height;
        }
      });

      if (!this.options.autoHeight) result['min-height'] = `${maxHeight}px`;

      result['max-width'] = `${this.$element[0].getBoundingClientRect().width}px`;

      return result;
    }

    /**
     * Destroys the Drilldown Menu
     * @function
     */
    destroy() {
      if (this.options.scrollTop) this.$element.off('.zf.drilldown', this._bindHandler);
      this._hideAll();
      this.$element.off('mutateme.zf.trigger');
      Foundation.Nest.Burn(this.$element, 'drilldown');
      this.$element.unwrap().find('.js-drilldown-back, .is-submenu-parent-item').remove().end().find('.is-active, .is-closing, .is-drilldown-submenu').removeClass('is-active is-closing is-drilldown-submenu').end().find('[data-submenu]').removeAttr('aria-hidden tabindex role');
      this.$submenuAnchors.each(function () {
        $(this).off('.zf.drilldown');
      });

      this.$submenus.removeClass('drilldown-submenu-cover-previous');

      this.$element.find('a').each(function () {
        var $link = $(this);
        $link.removeAttr('tabindex');
        if ($link.data('savedHref')) {
          $link.attr('href', $link.data('savedHref')).removeData('savedHref');
        } else {
          return;
        }
      });
      Foundation.unregisterPlugin(this);
    }
  }

  Drilldown.defaults = {
    /**
     * Markup used for JS generated back button. Prepended  or appended (see backButtonPosition) to submenu lists and deleted on `destroy` method, 'js-drilldown-back' class required. Remove the backslash (`\`) if copy and pasting.
     * @option
     * @example '<\li><\a>Back<\/a><\/li>'
     */
    backButton: '<li class="js-drilldown-back"><a tabindex="0">Back</a></li>',
    /**
     * Position the back button either at the top or bottom of drilldown submenus.
     * @option
     * @example bottom
     */
    backButtonPosition: 'top',
    /**
     * Markup used to wrap drilldown menu. Use a class name for independent styling; the JS applied class: `is-drilldown` is required. Remove the backslash (`\`) if copy and pasting.
     * @option
     * @example '<\div class="is-drilldown"><\/div>'
     */
    wrapper: '<div></div>',
    /**
     * Adds the parent link to the submenu.
     * @option
     * @example false
     */
    parentLink: false,
    /**
     * Allow the menu to return to root list on body click.
     * @option
     * @example false
     */
    closeOnClick: false,
    /**
     * Allow the menu to auto adjust height.
     * @option
     * @example false
     */
    autoHeight: false,
    /**
     * Animate the auto adjust height.
     * @option
     * @example false
     */
    animateHeight: false,
    /**
     * Scroll to the top of the menu after opening a submenu or navigating back using the menu back button
     * @option
     * @example false
     */
    scrollTop: false,
    /**
     * String jquery selector (for example 'body') of element to take offset().top from, if empty string the drilldown menu offset().top is taken
     * @option
     * @example ''
     */
    scrollTopElement: '',
    /**
     * ScrollTop offset
     * @option
     * @example 100
     */
    scrollTopOffset: 0,
    /**
     * Scroll animation duration
     * @option
     * @example 500
     */
    animationDuration: 500,
    /**
     * Scroll animation easing
     * @option
     * @example 'swing'
     */
    animationEasing: 'swing'
    // holdOpen: false
  };

  // Window exports
  Foundation.plugin(Drilldown, 'Drilldown');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Dropdown module.
   * @module foundation.dropdown
   * @requires foundation.util.keyboard
   * @requires foundation.util.box
   * @requires foundation.util.triggers
   */

  class Dropdown {
    /**
     * Creates a new instance of a dropdown.
     * @class
     * @param {jQuery} element - jQuery object to make into a dropdown.
     *        Object should be of the dropdown panel, rather than its anchor.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Dropdown.defaults, this.$element.data(), options);
      this._init();

      Foundation.registerPlugin(this, 'Dropdown');
      Foundation.Keyboard.register('Dropdown', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the plugin by setting/checking options and attributes, adding helper variables, and saving the anchor.
     * @function
     * @private
     */
    _init() {
      var $id = this.$element.attr('id');

      this.$anchor = $(`[data-toggle="${$id}"]`).length ? $(`[data-toggle="${$id}"]`) : $(`[data-open="${$id}"]`);
      this.$anchor.attr({
        'aria-controls': $id,
        'data-is-focus': false,
        'data-yeti-box': $id,
        'aria-haspopup': true,
        'aria-expanded': false

      });

      if (this.options.parentClass) {
        this.$parent = this.$element.parents('.' + this.options.parentClass);
      } else {
        this.$parent = null;
      }
      this.options.positionClass = this.getPositionClass();
      this.counter = 4;
      this.usedPositions = [];
      this.$element.attr({
        'aria-hidden': 'true',
        'data-yeti-box': $id,
        'data-resize': $id,
        'aria-labelledby': this.$anchor[0].id || Foundation.GetYoDigits(6, 'dd-anchor')
      });
      this._events();
    }

    /**
     * Helper function to determine current orientation of dropdown pane.
     * @function
     * @returns {String} position - string value of a position class.
     */
    getPositionClass() {
      var verticalPosition = this.$element[0].className.match(/(top|left|right|bottom)/g);
      verticalPosition = verticalPosition ? verticalPosition[0] : '';
      var horizontalPosition = /float-(\S+)/.exec(this.$anchor[0].className);
      horizontalPosition = horizontalPosition ? horizontalPosition[1] : '';
      var position = horizontalPosition ? horizontalPosition + ' ' + verticalPosition : verticalPosition;

      return position;
    }

    /**
     * Adjusts the dropdown panes orientation by adding/removing positioning classes.
     * @function
     * @private
     * @param {String} position - position class to remove.
     */
    _reposition(position) {
      this.usedPositions.push(position ? position : 'bottom');
      //default, try switching to opposite side
      if (!position && this.usedPositions.indexOf('top') < 0) {
        this.$element.addClass('top');
      } else if (position === 'top' && this.usedPositions.indexOf('bottom') < 0) {
        this.$element.removeClass(position);
      } else if (position === 'left' && this.usedPositions.indexOf('right') < 0) {
        this.$element.removeClass(position).addClass('right');
      } else if (position === 'right' && this.usedPositions.indexOf('left') < 0) {
        this.$element.removeClass(position).addClass('left');
      }

      //if default change didn't work, try bottom or left first
      else if (!position && this.usedPositions.indexOf('top') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.$element.addClass('left');
        } else if (position === 'top' && this.usedPositions.indexOf('bottom') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.$element.removeClass(position).addClass('left');
        } else if (position === 'left' && this.usedPositions.indexOf('right') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.$element.removeClass(position);
        } else if (position === 'right' && this.usedPositions.indexOf('left') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.$element.removeClass(position);
        }
        //if nothing cleared, set to bottom
        else {
            this.$element.removeClass(position);
          }
      this.classChanged = true;
      this.counter--;
    }

    /**
     * Sets the position and orientation of the dropdown pane, checks for collisions.
     * Recursively calls itself if a collision is detected, with a new position class.
     * @function
     * @private
     */
    _setPosition() {
      if (this.$anchor.attr('aria-expanded') === 'false') {
        return false;
      }
      var position = this.getPositionClass(),
          $eleDims = Foundation.Box.GetDimensions(this.$element),
          $anchorDims = Foundation.Box.GetDimensions(this.$anchor),
          _this = this,
          direction = position === 'left' ? 'left' : position === 'right' ? 'left' : 'top',
          param = direction === 'top' ? 'height' : 'width',
          offset = param === 'height' ? this.options.vOffset : this.options.hOffset;

      if ($eleDims.width >= $eleDims.windowDims.width || !this.counter && !Foundation.Box.ImNotTouchingYou(this.$element, this.$parent)) {
        var newWidth = $eleDims.windowDims.width,
            parentHOffset = 0;
        if (this.$parent) {
          var $parentDims = Foundation.Box.GetDimensions(this.$parent),
              parentHOffset = $parentDims.offset.left;
          if ($parentDims.width < newWidth) {
            newWidth = $parentDims.width;
          }
        }

        this.$element.offset(Foundation.Box.GetOffsets(this.$element, this.$anchor, 'center bottom', this.options.vOffset, this.options.hOffset + parentHOffset, true)).css({
          'width': newWidth - this.options.hOffset * 2,
          'height': 'auto'
        });
        this.classChanged = true;
        return false;
      }

      this.$element.offset(Foundation.Box.GetOffsets(this.$element, this.$anchor, position, this.options.vOffset, this.options.hOffset));

      while (!Foundation.Box.ImNotTouchingYou(this.$element, this.$parent, true) && this.counter) {
        this._reposition(position);
        this._setPosition();
      }
    }

    /**
     * Adds event listeners to the element utilizing the triggers utility library.
     * @function
     * @private
     */
    _events() {
      var _this = this;
      this.$element.on({
        'open.zf.trigger': this.open.bind(this),
        'close.zf.trigger': this.close.bind(this),
        'toggle.zf.trigger': this.toggle.bind(this),
        'resizeme.zf.trigger': this._setPosition.bind(this)
      });

      if (this.options.hover) {
        this.$anchor.off('mouseenter.zf.dropdown mouseleave.zf.dropdown').on('mouseenter.zf.dropdown', function () {
          var bodyData = $('body').data();
          if (typeof bodyData.whatinput === 'undefined' || bodyData.whatinput === 'mouse') {
            clearTimeout(_this.timeout);
            _this.timeout = setTimeout(function () {
              _this.open();
              _this.$anchor.data('hover', true);
            }, _this.options.hoverDelay);
          }
        }).on('mouseleave.zf.dropdown', function () {
          clearTimeout(_this.timeout);
          _this.timeout = setTimeout(function () {
            _this.close();
            _this.$anchor.data('hover', false);
          }, _this.options.hoverDelay);
        });
        if (this.options.hoverPane) {
          this.$element.off('mouseenter.zf.dropdown mouseleave.zf.dropdown').on('mouseenter.zf.dropdown', function () {
            clearTimeout(_this.timeout);
          }).on('mouseleave.zf.dropdown', function () {
            clearTimeout(_this.timeout);
            _this.timeout = setTimeout(function () {
              _this.close();
              _this.$anchor.data('hover', false);
            }, _this.options.hoverDelay);
          });
        }
      }
      this.$anchor.add(this.$element).on('keydown.zf.dropdown', function (e) {

        var $target = $(this),
            visibleFocusableElements = Foundation.Keyboard.findFocusable(_this.$element);

        Foundation.Keyboard.handleKey(e, 'Dropdown', {
          open: function () {
            if ($target.is(_this.$anchor)) {
              _this.open();
              _this.$element.attr('tabindex', -1).focus();
              e.preventDefault();
            }
          },
          close: function () {
            _this.close();
            _this.$anchor.focus();
          }
        });
      });
    }

    /**
     * Adds an event handler to the body to close any dropdowns on a click.
     * @function
     * @private
     */
    _addBodyHandler() {
      var $body = $(document.body).not(this.$element),
          _this = this;
      $body.off('click.zf.dropdown').on('click.zf.dropdown', function (e) {
        if (_this.$anchor.is(e.target) || _this.$anchor.find(e.target).length) {
          return;
        }
        if (_this.$element.find(e.target).length) {
          return;
        }
        _this.close();
        $body.off('click.zf.dropdown');
      });
    }

    /**
     * Opens the dropdown pane, and fires a bubbling event to close other dropdowns.
     * @function
     * @fires Dropdown#closeme
     * @fires Dropdown#show
     */
    open() {
      // var _this = this;
      /**
       * Fires to close other open dropdowns
       * @event Dropdown#closeme
       */
      this.$element.trigger('closeme.zf.dropdown', this.$element.attr('id'));
      this.$anchor.addClass('hover').attr({ 'aria-expanded': true });
      // this.$element/*.show()*/;
      this._setPosition();
      this.$element.addClass('is-open').attr({ 'aria-hidden': false });

      if (this.options.autoFocus) {
        var $focusable = Foundation.Keyboard.findFocusable(this.$element);
        if ($focusable.length) {
          $focusable.eq(0).focus();
        }
      }

      if (this.options.closeOnClick) {
        this._addBodyHandler();
      }

      if (this.options.trapFocus) {
        Foundation.Keyboard.trapFocus(this.$element);
      }

      /**
       * Fires once the dropdown is visible.
       * @event Dropdown#show
       */
      this.$element.trigger('show.zf.dropdown', [this.$element]);
    }

    /**
     * Closes the open dropdown pane.
     * @function
     * @fires Dropdown#hide
     */
    close() {
      if (!this.$element.hasClass('is-open')) {
        return false;
      }
      this.$element.removeClass('is-open').attr({ 'aria-hidden': true });

      this.$anchor.removeClass('hover').attr('aria-expanded', false);

      if (this.classChanged) {
        var curPositionClass = this.getPositionClass();
        if (curPositionClass) {
          this.$element.removeClass(curPositionClass);
        }
        this.$element.addClass(this.options.positionClass)
        /*.hide()*/.css({ height: '', width: '' });
        this.classChanged = false;
        this.counter = 4;
        this.usedPositions.length = 0;
      }
      this.$element.trigger('hide.zf.dropdown', [this.$element]);

      if (this.options.trapFocus) {
        Foundation.Keyboard.releaseFocus(this.$element);
      }
    }

    /**
     * Toggles the dropdown pane's visibility.
     * @function
     */
    toggle() {
      if (this.$element.hasClass('is-open')) {
        if (this.$anchor.data('hover')) return;
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Destroys the dropdown.
     * @function
     */
    destroy() {
      this.$element.off('.zf.trigger').hide();
      this.$anchor.off('.zf.dropdown');

      Foundation.unregisterPlugin(this);
    }
  }

  Dropdown.defaults = {
    /**
     * Class that designates bounding container of Dropdown (Default: window)
     * @option
     * @example 'dropdown-parent'
     */
    parentClass: null,
    /**
     * Amount of time to delay opening a submenu on hover event.
     * @option
     * @example 250
     */
    hoverDelay: 250,
    /**
     * Allow submenus to open on hover events
     * @option
     * @example false
     */
    hover: false,
    /**
     * Don't close dropdown when hovering over dropdown pane
     * @option
     * @example true
     */
    hoverPane: false,
    /**
     * Number of pixels between the dropdown pane and the triggering element on open.
     * @option
     * @example 1
     */
    vOffset: 1,
    /**
     * Number of pixels between the dropdown pane and the triggering element on open.
     * @option
     * @example 1
     */
    hOffset: 1,
    /**
     * Class applied to adjust open position. JS will test and fill this in.
     * @option
     * @example 'top'
     */
    positionClass: '',
    /**
     * Allow the plugin to trap focus to the dropdown pane if opened with keyboard commands.
     * @option
     * @example false
     */
    trapFocus: false,
    /**
     * Allow the plugin to set focus to the first focusable element within the pane, regardless of method of opening.
     * @option
     * @example true
     */
    autoFocus: false,
    /**
     * Allows a click on the body to close the dropdown.
     * @option
     * @example false
     */
    closeOnClick: false
  };

  // Window exports
  Foundation.plugin(Dropdown, 'Dropdown');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * DropdownMenu module.
   * @module foundation.dropdown-menu
   * @requires foundation.util.keyboard
   * @requires foundation.util.box
   * @requires foundation.util.nest
   */

  class DropdownMenu {
    /**
     * Creates a new instance of DropdownMenu.
     * @class
     * @fires DropdownMenu#init
     * @param {jQuery} element - jQuery object to make into a dropdown menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, DropdownMenu.defaults, this.$element.data(), options);

      Foundation.Nest.Feather(this.$element, 'dropdown');
      this._init();

      Foundation.registerPlugin(this, 'DropdownMenu');
      Foundation.Keyboard.register('DropdownMenu', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ARROW_RIGHT': 'next',
        'ARROW_UP': 'up',
        'ARROW_DOWN': 'down',
        'ARROW_LEFT': 'previous',
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the plugin, and calls _prepareMenu
     * @private
     * @function
     */
    _init() {
      var subs = this.$element.find('li.is-dropdown-submenu-parent');
      this.$element.children('.is-dropdown-submenu-parent').children('.is-dropdown-submenu').addClass('first-sub');

      this.$menuItems = this.$element.find('[role="menuitem"]');
      this.$tabs = this.$element.children('[role="menuitem"]');
      this.$tabs.find('ul.is-dropdown-submenu').addClass(this.options.verticalClass);

      if (this.$element.hasClass(this.options.rightClass) || this.options.alignment === 'right' || Foundation.rtl() || this.$element.parents('.top-bar-right').is('*')) {
        this.options.alignment = 'right';
        subs.addClass('opens-left');
      } else {
        subs.addClass('opens-right');
      }
      this.changed = false;
      this._events();
    }

    _isVertical() {
      return this.$tabs.css('display') === 'block';
    }

    /**
     * Adds event listeners to elements within the menu
     * @private
     * @function
     */
    _events() {
      var _this = this,
          hasTouch = 'ontouchstart' in window || typeof window.ontouchstart !== 'undefined',
          parClass = 'is-dropdown-submenu-parent';

      // used for onClick and in the keyboard handlers
      var handleClickFn = function (e) {
        var $elem = $(e.target).parentsUntil('ul', `.${parClass}`),
            hasSub = $elem.hasClass(parClass),
            hasClicked = $elem.attr('data-is-click') === 'true',
            $sub = $elem.children('.is-dropdown-submenu');

        if (hasSub) {
          if (hasClicked) {
            if (!_this.options.closeOnClick || !_this.options.clickOpen && !hasTouch || _this.options.forceFollow && hasTouch) {
              return;
            } else {
              e.stopImmediatePropagation();
              e.preventDefault();
              _this._hide($elem);
            }
          } else {
            e.preventDefault();
            e.stopImmediatePropagation();
            _this._show($sub);
            $elem.add($elem.parentsUntil(_this.$element, `.${parClass}`)).attr('data-is-click', true);
          }
        }
      };

      if (this.options.clickOpen || hasTouch) {
        this.$menuItems.on('click.zf.dropdownmenu touchstart.zf.dropdownmenu', handleClickFn);
      }

      // Handle Leaf element Clicks
      if (_this.options.closeOnClickInside) {
        this.$menuItems.on('click.zf.dropdownmenu touchend.zf.dropdownmenu', function (e) {
          var $elem = $(this),
              hasSub = $elem.hasClass(parClass);
          if (!hasSub) {
            _this._hide();
          }
        });
      }

      if (!this.options.disableHover) {
        this.$menuItems.on('mouseenter.zf.dropdownmenu', function (e) {
          var $elem = $(this),
              hasSub = $elem.hasClass(parClass);

          if (hasSub) {
            clearTimeout($elem.data('_delay'));
            $elem.data('_delay', setTimeout(function () {
              _this._show($elem.children('.is-dropdown-submenu'));
            }, _this.options.hoverDelay));
          }
        }).on('mouseleave.zf.dropdownmenu', function (e) {
          var $elem = $(this),
              hasSub = $elem.hasClass(parClass);
          if (hasSub && _this.options.autoclose) {
            if ($elem.attr('data-is-click') === 'true' && _this.options.clickOpen) {
              return false;
            }

            clearTimeout($elem.data('_delay'));
            $elem.data('_delay', setTimeout(function () {
              _this._hide($elem);
            }, _this.options.closingTime));
          }
        });
      }
      this.$menuItems.on('keydown.zf.dropdownmenu', function (e) {
        var $element = $(e.target).parentsUntil('ul', '[role="menuitem"]'),
            isTab = _this.$tabs.index($element) > -1,
            $elements = isTab ? _this.$tabs : $element.siblings('li').add($element),
            $prevElement,
            $nextElement;

        $elements.each(function (i) {
          if ($(this).is($element)) {
            $prevElement = $elements.eq(i - 1);
            $nextElement = $elements.eq(i + 1);
            return;
          }
        });

        var nextSibling = function () {
          if (!$element.is(':last-child')) {
            $nextElement.children('a:first').focus();
            e.preventDefault();
          }
        },
            prevSibling = function () {
          $prevElement.children('a:first').focus();
          e.preventDefault();
        },
            openSub = function () {
          var $sub = $element.children('ul.is-dropdown-submenu');
          if ($sub.length) {
            _this._show($sub);
            $element.find('li > a:first').focus();
            e.preventDefault();
          } else {
            return;
          }
        },
            closeSub = function () {
          //if ($element.is(':first-child')) {
          var close = $element.parent('ul').parent('li');
          close.children('a:first').focus();
          _this._hide(close);
          e.preventDefault();
          //}
        };
        var functions = {
          open: openSub,
          close: function () {
            _this._hide(_this.$element);
            _this.$menuItems.find('a:first').focus(); // focus to first element
            e.preventDefault();
          },
          handled: function () {
            e.stopImmediatePropagation();
          }
        };

        if (isTab) {
          if (_this._isVertical()) {
            // vertical menu
            if (Foundation.rtl()) {
              // right aligned
              $.extend(functions, {
                down: nextSibling,
                up: prevSibling,
                next: closeSub,
                previous: openSub
              });
            } else {
              // left aligned
              $.extend(functions, {
                down: nextSibling,
                up: prevSibling,
                next: openSub,
                previous: closeSub
              });
            }
          } else {
            // horizontal menu
            if (Foundation.rtl()) {
              // right aligned
              $.extend(functions, {
                next: prevSibling,
                previous: nextSibling,
                down: openSub,
                up: closeSub
              });
            } else {
              // left aligned
              $.extend(functions, {
                next: nextSibling,
                previous: prevSibling,
                down: openSub,
                up: closeSub
              });
            }
          }
        } else {
          // not tabs -> one sub
          if (Foundation.rtl()) {
            // right aligned
            $.extend(functions, {
              next: closeSub,
              previous: openSub,
              down: nextSibling,
              up: prevSibling
            });
          } else {
            // left aligned
            $.extend(functions, {
              next: openSub,
              previous: closeSub,
              down: nextSibling,
              up: prevSibling
            });
          }
        }
        Foundation.Keyboard.handleKey(e, 'DropdownMenu', functions);
      });
    }

    /**
     * Adds an event handler to the body to close any dropdowns on a click.
     * @function
     * @private
     */
    _addBodyHandler() {
      var $body = $(document.body),
          _this = this;
      $body.off('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu').on('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu', function (e) {
        var $link = _this.$element.find(e.target);
        if ($link.length) {
          return;
        }

        _this._hide();
        $body.off('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu');
      });
    }

    /**
     * Opens a dropdown pane, and checks for collisions first.
     * @param {jQuery} $sub - ul element that is a submenu to show
     * @function
     * @private
     * @fires DropdownMenu#show
     */
    _show($sub) {
      var idx = this.$tabs.index(this.$tabs.filter(function (i, el) {
        return $(el).find($sub).length > 0;
      }));
      var $sibs = $sub.parent('li.is-dropdown-submenu-parent').siblings('li.is-dropdown-submenu-parent');
      this._hide($sibs, idx);
      $sub.css('visibility', 'hidden').addClass('js-dropdown-active').parent('li.is-dropdown-submenu-parent').addClass('is-active');
      var clear = Foundation.Box.ImNotTouchingYou($sub, null, true);
      if (!clear) {
        var oldClass = this.options.alignment === 'left' ? '-right' : '-left',
            $parentLi = $sub.parent('.is-dropdown-submenu-parent');
        $parentLi.removeClass(`opens${oldClass}`).addClass(`opens-${this.options.alignment}`);
        clear = Foundation.Box.ImNotTouchingYou($sub, null, true);
        if (!clear) {
          $parentLi.removeClass(`opens-${this.options.alignment}`).addClass('opens-inner');
        }
        this.changed = true;
      }
      $sub.css('visibility', '');
      if (this.options.closeOnClick) {
        this._addBodyHandler();
      }
      /**
       * Fires when the new dropdown pane is visible.
       * @event DropdownMenu#show
       */
      this.$element.trigger('show.zf.dropdownmenu', [$sub]);
    }

    /**
     * Hides a single, currently open dropdown pane, if passed a parameter, otherwise, hides everything.
     * @function
     * @param {jQuery} $elem - element with a submenu to hide
     * @param {Number} idx - index of the $tabs collection to hide
     * @private
     */
    _hide($elem, idx) {
      var $toClose;
      if ($elem && $elem.length) {
        $toClose = $elem;
      } else if (idx !== undefined) {
        $toClose = this.$tabs.not(function (i, el) {
          return i === idx;
        });
      } else {
        $toClose = this.$element;
      }
      var somethingToClose = $toClose.hasClass('is-active') || $toClose.find('.is-active').length > 0;

      if (somethingToClose) {
        $toClose.find('li.is-active').add($toClose).attr({
          'data-is-click': false
        }).removeClass('is-active');

        $toClose.find('ul.js-dropdown-active').removeClass('js-dropdown-active');

        if (this.changed || $toClose.find('opens-inner').length) {
          var oldClass = this.options.alignment === 'left' ? 'right' : 'left';
          $toClose.find('li.is-dropdown-submenu-parent').add($toClose).removeClass(`opens-inner opens-${this.options.alignment}`).addClass(`opens-${oldClass}`);
          this.changed = false;
        }
        /**
         * Fires when the open menus are closed.
         * @event DropdownMenu#hide
         */
        this.$element.trigger('hide.zf.dropdownmenu', [$toClose]);
      }
    }

    /**
     * Destroys the plugin.
     * @function
     */
    destroy() {
      this.$menuItems.off('.zf.dropdownmenu').removeAttr('data-is-click').removeClass('is-right-arrow is-left-arrow is-down-arrow opens-right opens-left opens-inner');
      $(document.body).off('.zf.dropdownmenu');
      Foundation.Nest.Burn(this.$element, 'dropdown');
      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  DropdownMenu.defaults = {
    /**
     * Disallows hover events from opening submenus
     * @option
     * @example false
     */
    disableHover: false,
    /**
     * Allow a submenu to automatically close on a mouseleave event, if not clicked open.
     * @option
     * @example true
     */
    autoclose: true,
    /**
     * Amount of time to delay opening a submenu on hover event.
     * @option
     * @example 50
     */
    hoverDelay: 50,
    /**
     * Allow a submenu to open/remain open on parent click event. Allows cursor to move away from menu.
     * @option
     * @example true
     */
    clickOpen: false,
    /**
     * Amount of time to delay closing a submenu on a mouseleave event.
     * @option
     * @example 500
     */

    closingTime: 500,
    /**
     * Position of the menu relative to what direction the submenus should open. Handled by JS.
     * @option
     * @example 'left'
     */
    alignment: 'left',
    /**
     * Allow clicks on the body to close any open submenus.
     * @option
     * @example true
     */
    closeOnClick: true,
    /**
     * Allow clicks on leaf anchor links to close any open submenus.
     * @option
     * @example true
     */
    closeOnClickInside: true,
    /**
     * Class applied to vertical oriented menus, Foundation default is `vertical`. Update this if using your own class.
     * @option
     * @example 'vertical'
     */
    verticalClass: 'vertical',
    /**
     * Class applied to right-side oriented menus, Foundation default is `align-right`. Update this if using your own class.
     * @option
     * @example 'align-right'
     */
    rightClass: 'align-right',
    /**
     * Boolean to force overide the clicking of links to perform default action, on second touch event for mobile.
     * @option
     * @example false
     */
    forceFollow: true
  };

  // Window exports
  Foundation.plugin(DropdownMenu, 'DropdownMenu');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Equalizer module.
   * @module foundation.equalizer
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.timerAndImageLoader if equalizer contains images
   */

  class Equalizer {
    /**
     * Creates a new instance of Equalizer.
     * @class
     * @fires Equalizer#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Equalizer.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Equalizer');
    }

    /**
     * Initializes the Equalizer plugin and calls functions to get equalizer functioning on load.
     * @private
     */
    _init() {
      var eqId = this.$element.attr('data-equalizer') || '';
      var $watched = this.$element.find(`[data-equalizer-watch="${eqId}"]`);

      this.$watched = $watched.length ? $watched : this.$element.find('[data-equalizer-watch]');
      this.$element.attr('data-resize', eqId || Foundation.GetYoDigits(6, 'eq'));
      this.$element.attr('data-mutate', eqId || Foundation.GetYoDigits(6, 'eq'));

      this.hasNested = this.$element.find('[data-equalizer]').length > 0;
      this.isNested = this.$element.parentsUntil(document.body, '[data-equalizer]').length > 0;
      this.isOn = false;
      this._bindHandler = {
        onResizeMeBound: this._onResizeMe.bind(this),
        onPostEqualizedBound: this._onPostEqualized.bind(this)
      };

      var imgs = this.$element.find('img');
      var tooSmall;
      if (this.options.equalizeOn) {
        tooSmall = this._checkMQ();
        $(window).on('changed.zf.mediaquery', this._checkMQ.bind(this));
      } else {
        this._events();
      }
      if (tooSmall !== undefined && tooSmall === false || tooSmall === undefined) {
        if (imgs.length) {
          Foundation.onImagesLoaded(imgs, this._reflow.bind(this));
        } else {
          this._reflow();
        }
      }
    }

    /**
     * Removes event listeners if the breakpoint is too small.
     * @private
     */
    _pauseEvents() {
      this.isOn = false;
      this.$element.off({
        '.zf.equalizer': this._bindHandler.onPostEqualizedBound,
        'resizeme.zf.trigger': this._bindHandler.onResizeMeBound,
        'mutateme.zf.trigger': this._bindHandler.onResizeMeBound
      });
    }

    /**
     * function to handle $elements resizeme.zf.trigger, with bound this on _bindHandler.onResizeMeBound
     * @private
     */
    _onResizeMe(e) {
      this._reflow();
    }

    /**
     * function to handle $elements postequalized.zf.equalizer, with bound this on _bindHandler.onPostEqualizedBound
     * @private
     */
    _onPostEqualized(e) {
      if (e.target !== this.$element[0]) {
        this._reflow();
      }
    }

    /**
     * Initializes events for Equalizer.
     * @private
     */
    _events() {
      var _this = this;
      this._pauseEvents();
      if (this.hasNested) {
        this.$element.on('postequalized.zf.equalizer', this._bindHandler.onPostEqualizedBound);
      } else {
        this.$element.on('resizeme.zf.trigger', this._bindHandler.onResizeMeBound);
        this.$element.on('mutateme.zf.trigger', this._bindHandler.onResizeMeBound);
      }
      this.isOn = true;
    }

    /**
     * Checks the current breakpoint to the minimum required size.
     * @private
     */
    _checkMQ() {
      var tooSmall = !Foundation.MediaQuery.is(this.options.equalizeOn);
      if (tooSmall) {
        if (this.isOn) {
          this._pauseEvents();
          this.$watched.css('height', 'auto');
        }
      } else {
        if (!this.isOn) {
          this._events();
        }
      }
      return tooSmall;
    }

    /**
     * A noop version for the plugin
     * @private
     */
    _killswitch() {
      return;
    }

    /**
     * Calls necessary functions to update Equalizer upon DOM change
     * @private
     */
    _reflow() {
      if (!this.options.equalizeOnStack) {
        if (this._isStacked()) {
          this.$watched.css('height', 'auto');
          return false;
        }
      }
      if (this.options.equalizeByRow) {
        this.getHeightsByRow(this.applyHeightByRow.bind(this));
      } else {
        this.getHeights(this.applyHeight.bind(this));
      }
    }

    /**
     * Manually determines if the first 2 elements are *NOT* stacked.
     * @private
     */
    _isStacked() {
      if (!this.$watched[0] || !this.$watched[1]) {
        return true;
      }
      return this.$watched[0].getBoundingClientRect().top !== this.$watched[1].getBoundingClientRect().top;
    }

    /**
     * Finds the outer heights of children contained within an Equalizer parent and returns them in an array
     * @param {Function} cb - A non-optional callback to return the heights array to.
     * @returns {Array} heights - An array of heights of children within Equalizer container
     */
    getHeights(cb) {
      var heights = [];
      for (var i = 0, len = this.$watched.length; i < len; i++) {
        this.$watched[i].style.height = 'auto';
        heights.push(this.$watched[i].offsetHeight);
      }
      cb(heights);
    }

    /**
     * Finds the outer heights of children contained within an Equalizer parent and returns them in an array
     * @param {Function} cb - A non-optional callback to return the heights array to.
     * @returns {Array} groups - An array of heights of children within Equalizer container grouped by row with element,height and max as last child
     */
    getHeightsByRow(cb) {
      var lastElTopOffset = this.$watched.length ? this.$watched.first().offset().top : 0,
          groups = [],
          group = 0;
      //group by Row
      groups[group] = [];
      for (var i = 0, len = this.$watched.length; i < len; i++) {
        this.$watched[i].style.height = 'auto';
        //maybe could use this.$watched[i].offsetTop
        var elOffsetTop = $(this.$watched[i]).offset().top;
        if (elOffsetTop != lastElTopOffset) {
          group++;
          groups[group] = [];
          lastElTopOffset = elOffsetTop;
        }
        groups[group].push([this.$watched[i], this.$watched[i].offsetHeight]);
      }

      for (var j = 0, ln = groups.length; j < ln; j++) {
        var heights = $(groups[j]).map(function () {
          return this[1];
        }).get();
        var max = Math.max.apply(null, heights);
        groups[j].push(max);
      }
      cb(groups);
    }

    /**
     * Changes the CSS height property of each child in an Equalizer parent to match the tallest
     * @param {array} heights - An array of heights of children within Equalizer container
     * @fires Equalizer#preequalized
     * @fires Equalizer#postequalized
     */
    applyHeight(heights) {
      var max = Math.max.apply(null, heights);
      /**
       * Fires before the heights are applied
       * @event Equalizer#preequalized
       */
      this.$element.trigger('preequalized.zf.equalizer');

      this.$watched.css('height', max);

      /**
       * Fires when the heights have been applied
       * @event Equalizer#postequalized
       */
      this.$element.trigger('postequalized.zf.equalizer');
    }

    /**
     * Changes the CSS height property of each child in an Equalizer parent to match the tallest by row
     * @param {array} groups - An array of heights of children within Equalizer container grouped by row with element,height and max as last child
     * @fires Equalizer#preequalized
     * @fires Equalizer#preequalizedrow
     * @fires Equalizer#postequalizedrow
     * @fires Equalizer#postequalized
     */
    applyHeightByRow(groups) {
      /**
       * Fires before the heights are applied
       */
      this.$element.trigger('preequalized.zf.equalizer');
      for (var i = 0, len = groups.length; i < len; i++) {
        var groupsILength = groups[i].length,
            max = groups[i][groupsILength - 1];
        if (groupsILength <= 2) {
          $(groups[i][0][0]).css({ 'height': 'auto' });
          continue;
        }
        /**
          * Fires before the heights per row are applied
          * @event Equalizer#preequalizedrow
          */
        this.$element.trigger('preequalizedrow.zf.equalizer');
        for (var j = 0, lenJ = groupsILength - 1; j < lenJ; j++) {
          $(groups[i][j][0]).css({ 'height': max });
        }
        /**
          * Fires when the heights per row have been applied
          * @event Equalizer#postequalizedrow
          */
        this.$element.trigger('postequalizedrow.zf.equalizer');
      }
      /**
       * Fires when the heights have been applied
       */
      this.$element.trigger('postequalized.zf.equalizer');
    }

    /**
     * Destroys an instance of Equalizer.
     * @function
     */
    destroy() {
      this._pauseEvents();
      this.$watched.css('height', 'auto');

      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  Equalizer.defaults = {
    /**
     * Enable height equalization when stacked on smaller screens.
     * @option
     * @example true
     */
    equalizeOnStack: false,
    /**
     * Enable height equalization row by row.
     * @option
     * @example false
     */
    equalizeByRow: false,
    /**
     * String representing the minimum breakpoint size the plugin should equalize heights on.
     * @option
     * @example 'medium'
     */
    equalizeOn: ''
  };

  // Window exports
  Foundation.plugin(Equalizer, 'Equalizer');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Interchange module.
   * @module foundation.interchange
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.timerAndImageLoader
   */

  class Interchange {
    /**
     * Creates a new instance of Interchange.
     * @class
     * @fires Interchange#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Interchange.defaults, options);
      this.rules = [];
      this.currentPath = '';

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'Interchange');
    }

    /**
     * Initializes the Interchange plugin and calls functions to get interchange functioning on load.
     * @function
     * @private
     */
    _init() {
      this._addBreakpoints();
      this._generateRules();
      this._reflow();
    }

    /**
     * Initializes events for Interchange.
     * @function
     * @private
     */
    _events() {
      $(window).on('resize.zf.interchange', Foundation.util.throttle(() => {
        this._reflow();
      }, 50));
    }

    /**
     * Calls necessary functions to update Interchange upon DOM change
     * @function
     * @private
     */
    _reflow() {
      var match;

      // Iterate through each rule, but only save the last match
      for (var i in this.rules) {
        if (this.rules.hasOwnProperty(i)) {
          var rule = this.rules[i];
          if (window.matchMedia(rule.query).matches) {
            match = rule;
          }
        }
      }

      if (match) {
        this.replace(match.path);
      }
    }

    /**
     * Gets the Foundation breakpoints and adds them to the Interchange.SPECIAL_QUERIES object.
     * @function
     * @private
     */
    _addBreakpoints() {
      for (var i in Foundation.MediaQuery.queries) {
        if (Foundation.MediaQuery.queries.hasOwnProperty(i)) {
          var query = Foundation.MediaQuery.queries[i];
          Interchange.SPECIAL_QUERIES[query.name] = query.value;
        }
      }
    }

    /**
     * Checks the Interchange element for the provided media query + content pairings
     * @function
     * @private
     * @param {Object} element - jQuery object that is an Interchange instance
     * @returns {Array} scenarios - Array of objects that have 'mq' and 'path' keys with corresponding keys
     */
    _generateRules(element) {
      var rulesList = [];
      var rules;

      if (this.options.rules) {
        rules = this.options.rules;
      } else {
        rules = this.$element.data('interchange').match(/\[.*?\]/g);
      }

      for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
          var rule = rules[i].slice(1, -1).split(', ');
          var path = rule.slice(0, -1).join('');
          var query = rule[rule.length - 1];

          if (Interchange.SPECIAL_QUERIES[query]) {
            query = Interchange.SPECIAL_QUERIES[query];
          }

          rulesList.push({
            path: path,
            query: query
          });
        }
      }

      this.rules = rulesList;
    }

    /**
     * Update the `src` property of an image, or change the HTML of a container, to the specified path.
     * @function
     * @param {String} path - Path to the image or HTML partial.
     * @fires Interchange#replaced
     */
    replace(path) {
      if (this.currentPath === path) return;

      var _this = this,
          trigger = 'replaced.zf.interchange';

      // Replacing images
      if (this.$element[0].nodeName === 'IMG') {
        this.$element.attr('src', path).on('load', function () {
          _this.currentPath = path;
        }).trigger(trigger);
      }
      // Replacing background images
      else if (path.match(/\.(gif|jpg|jpeg|png|svg|tiff)([?#].*)?/i)) {
          this.$element.css({ 'background-image': 'url(' + path + ')' }).trigger(trigger);
        }
        // Replacing HTML
        else {
            $.get(path, function (response) {
              _this.$element.html(response).trigger(trigger);
              $(response).foundation();
              _this.currentPath = path;
            });
          }

      /**
       * Fires when content in an Interchange element is done being loaded.
       * @event Interchange#replaced
       */
      // this.$element.trigger('replaced.zf.interchange');
    }

    /**
     * Destroys an instance of interchange.
     * @function
     */
    destroy() {
      //TODO this.
    }
  }

  /**
   * Default settings for plugin
   */
  Interchange.defaults = {
    /**
     * Rules to be applied to Interchange elements. Set with the `data-interchange` array notation.
     * @option
     */
    rules: null
  };

  Interchange.SPECIAL_QUERIES = {
    'landscape': 'screen and (orientation: landscape)',
    'portrait': 'screen and (orientation: portrait)',
    'retina': 'only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (min--moz-device-pixel-ratio: 2), only screen and (-o-min-device-pixel-ratio: 2/1), only screen and (min-device-pixel-ratio: 2), only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx)'
  };

  // Window exports
  Foundation.plugin(Interchange, 'Interchange');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Magellan module.
   * @module foundation.magellan
   */

  class Magellan {
    /**
     * Creates a new instance of Magellan.
     * @class
     * @fires Magellan#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Magellan.defaults, this.$element.data(), options);

      this._init();
      this.calcPoints();

      Foundation.registerPlugin(this, 'Magellan');
    }

    /**
     * Initializes the Magellan plugin and calls functions to get equalizer functioning on load.
     * @private
     */
    _init() {
      var id = this.$element[0].id || Foundation.GetYoDigits(6, 'magellan');
      var _this = this;
      this.$targets = $('[data-magellan-target]');
      this.$links = this.$element.find('a');
      this.$element.attr({
        'data-resize': id,
        'data-scroll': id,
        'id': id
      });
      this.$active = $();
      this.scrollPos = parseInt(window.pageYOffset, 10);

      this._events();
    }

    /**
     * Calculates an array of pixel values that are the demarcation lines between locations on the page.
     * Can be invoked if new elements are added or the size of a location changes.
     * @function
     */
    calcPoints() {
      var _this = this,
          body = document.body,
          html = document.documentElement;

      this.points = [];
      this.winHeight = Math.round(Math.max(window.innerHeight, html.clientHeight));
      this.docHeight = Math.round(Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight));

      this.$targets.each(function () {
        var $tar = $(this),
            pt = Math.round($tar.offset().top - _this.options.threshold);
        $tar.targetPoint = pt;
        _this.points.push(pt);
      });
    }

    /**
     * Initializes events for Magellan.
     * @private
     */
    _events() {
      var _this = this,
          $body = $('html, body'),
          opts = {
        duration: _this.options.animationDuration,
        easing: _this.options.animationEasing
      };
      $(window).one('load', function () {
        if (_this.options.deepLinking) {
          if (location.hash) {
            _this.scrollToLoc(location.hash);
          }
        }
        _this.calcPoints();
        _this._updateActive();
      });

      this.$element.on({
        'resizeme.zf.trigger': this.reflow.bind(this),
        'scrollme.zf.trigger': this._updateActive.bind(this)
      }).on('click.zf.magellan', 'a[href^="#"]', function (e) {
        e.preventDefault();
        var arrival = this.getAttribute('href');
        _this.scrollToLoc(arrival);
      });
      $(window).on('popstate', function (e) {
        if (_this.options.deepLinking) {
          _this.scrollToLoc(window.location.hash);
        }
      });
    }

    /**
     * Function to scroll to a given location on the page.
     * @param {String} loc - a properly formatted jQuery id selector. Example: '#foo'
     * @function
     */
    scrollToLoc(loc) {
      // Do nothing if target does not exist to prevent errors
      if (!$(loc).length) {
        return false;
      }
      this._inTransition = true;
      var _this = this,
          scrollPos = Math.round($(loc).offset().top - this.options.threshold / 2 - this.options.barOffset);

      $('html, body').stop(true).animate({ scrollTop: scrollPos }, this.options.animationDuration, this.options.animationEasing, function () {
        _this._inTransition = false;_this._updateActive();
      });
    }

    /**
     * Calls necessary functions to update Magellan upon DOM change
     * @function
     */
    reflow() {
      this.calcPoints();
      this._updateActive();
    }

    /**
     * Updates the visibility of an active location link, and updates the url hash for the page, if deepLinking enabled.
     * @private
     * @function
     * @fires Magellan#update
     */
    _updateActive() /*evt, elem, scrollPos*/{
      if (this._inTransition) {
        return;
      }
      var winPos = /*scrollPos ||*/parseInt(window.pageYOffset, 10),
          curIdx;

      if (winPos + this.winHeight === this.docHeight) {
        curIdx = this.points.length - 1;
      } else if (winPos < this.points[0]) {
        curIdx = undefined;
      } else {
        var isDown = this.scrollPos < winPos,
            _this = this,
            curVisible = this.points.filter(function (p, i) {
          return isDown ? p - _this.options.barOffset <= winPos : p - _this.options.barOffset - _this.options.threshold <= winPos;
        });
        curIdx = curVisible.length ? curVisible.length - 1 : 0;
      }

      this.$active.removeClass(this.options.activeClass);
      this.$active = this.$links.filter('[href="#' + this.$targets.eq(curIdx).data('magellan-target') + '"]').addClass(this.options.activeClass);

      if (this.options.deepLinking) {
        var hash = "";
        if (curIdx != undefined) {
          hash = this.$active[0].getAttribute('href');
        }
        if (hash !== window.location.hash) {
          if (window.history.pushState) {
            window.history.pushState(null, null, hash);
          } else {
            window.location.hash = hash;
          }
        }
      }

      this.scrollPos = winPos;
      /**
       * Fires when magellan is finished updating to the new active element.
       * @event Magellan#update
       */
      this.$element.trigger('update.zf.magellan', [this.$active]);
    }

    /**
     * Destroys an instance of Magellan and resets the url of the window.
     * @function
     */
    destroy() {
      this.$element.off('.zf.trigger .zf.magellan').find(`.${this.options.activeClass}`).removeClass(this.options.activeClass);

      if (this.options.deepLinking) {
        var hash = this.$active[0].getAttribute('href');
        window.location.hash.replace(hash, '');
      }

      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  Magellan.defaults = {
    /**
     * Amount of time, in ms, the animated scrolling should take between locations.
     * @option
     * @example 500
     */
    animationDuration: 500,
    /**
     * Animation style to use when scrolling between locations.
     * @option
     * @example 'ease-in-out'
     */
    animationEasing: 'linear',
    /**
     * Number of pixels to use as a marker for location changes.
     * @option
     * @example 50
     */
    threshold: 50,
    /**
     * Class applied to the active locations link on the magellan container.
     * @option
     * @example 'active'
     */
    activeClass: 'active',
    /**
     * Allows the script to manipulate the url of the current page, and if supported, alter the history.
     * @option
     * @example true
     */
    deepLinking: false,
    /**
     * Number of pixels to offset the scroll of the page on item click if using a sticky nav bar.
     * @option
     * @example 25
     */
    barOffset: 0
  };

  // Window exports
  Foundation.plugin(Magellan, 'Magellan');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * OffCanvas module.
   * @module foundation.offcanvas
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.triggers
   * @requires foundation.util.motion
   */

  class OffCanvas {
    /**
     * Creates a new instance of an off-canvas wrapper.
     * @class
     * @fires OffCanvas#init
     * @param {Object} element - jQuery object to initialize.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, OffCanvas.defaults, this.$element.data(), options);
      this.$lastTrigger = $();
      this.$triggers = $();

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'OffCanvas');
      Foundation.Keyboard.register('OffCanvas', {
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the off-canvas wrapper by adding the exit overlay (if needed).
     * @function
     * @private
     */
    _init() {
      var id = this.$element.attr('id');

      this.$element.attr('aria-hidden', 'true');

      this.$element.addClass(`is-transition-${this.options.transition}`);

      // Find triggers that affect this element and add aria-expanded to them
      this.$triggers = $(document).find('[data-open="' + id + '"], [data-close="' + id + '"], [data-toggle="' + id + '"]').attr('aria-expanded', 'false').attr('aria-controls', id);

      // Add an overlay over the content if necessary
      if (this.options.contentOverlay === true) {
        var overlay = document.createElement('div');
        var overlayPosition = $(this.$element).css("position") === 'fixed' ? 'is-overlay-fixed' : 'is-overlay-absolute';
        overlay.setAttribute('class', 'js-off-canvas-overlay ' + overlayPosition);
        this.$overlay = $(overlay);
        if (overlayPosition === 'is-overlay-fixed') {
          $('body').append(this.$overlay);
        } else {
          this.$element.siblings('[data-off-canvas-content]').append(this.$overlay);
        }
      }

      this.options.isRevealed = this.options.isRevealed || new RegExp(this.options.revealClass, 'g').test(this.$element[0].className);

      if (this.options.isRevealed === true) {
        this.options.revealOn = this.options.revealOn || this.$element[0].className.match(/(reveal-for-medium|reveal-for-large)/g)[0].split('-')[2];
        this._setMQChecker();
      }
      if (!this.options.transitionTime === true) {
        this.options.transitionTime = parseFloat(window.getComputedStyle($('[data-off-canvas]')[0]).transitionDuration) * 1000;
      }
    }

    /**
     * Adds event handlers to the off-canvas wrapper and the exit overlay.
     * @function
     * @private
     */
    _events() {
      this.$element.off('.zf.trigger .zf.offcanvas').on({
        'open.zf.trigger': this.open.bind(this),
        'close.zf.trigger': this.close.bind(this),
        'toggle.zf.trigger': this.toggle.bind(this),
        'keydown.zf.offcanvas': this._handleKeyboard.bind(this)
      });

      if (this.options.closeOnClick === true) {
        var $target = this.options.contentOverlay ? this.$overlay : $('[data-off-canvas-content]');
        $target.on({ 'click.zf.offcanvas': this.close.bind(this) });
      }
    }

    /**
     * Applies event listener for elements that will reveal at certain breakpoints.
     * @private
     */
    _setMQChecker() {
      var _this = this;

      $(window).on('changed.zf.mediaquery', function () {
        if (Foundation.MediaQuery.atLeast(_this.options.revealOn)) {
          _this.reveal(true);
        } else {
          _this.reveal(false);
        }
      }).one('load.zf.offcanvas', function () {
        if (Foundation.MediaQuery.atLeast(_this.options.revealOn)) {
          _this.reveal(true);
        }
      });
    }

    /**
     * Handles the revealing/hiding the off-canvas at breakpoints, not the same as open.
     * @param {Boolean} isRevealed - true if element should be revealed.
     * @function
     */
    reveal(isRevealed) {
      var $closer = this.$element.find('[data-close]');
      if (isRevealed) {
        this.close();
        this.isRevealed = true;
        this.$element.attr('aria-hidden', 'false');
        this.$element.off('open.zf.trigger toggle.zf.trigger');
        if ($closer.length) {
          $closer.hide();
        }
      } else {
        this.isRevealed = false;
        this.$element.attr('aria-hidden', 'true');
        this.$element.on({
          'open.zf.trigger': this.open.bind(this),
          'toggle.zf.trigger': this.toggle.bind(this)
        });
        if ($closer.length) {
          $closer.show();
        }
      }
    }

    /**
     * Stops scrolling of the body when offcanvas is open on mobile Safari and other troublesome browsers.
     * @private
     */
    _stopScrolling(event) {
      return false;
    }

    /**
     * Opens the off-canvas menu.
     * @function
     * @param {Object} event - Event object passed from listener.
     * @param {jQuery} trigger - element that triggered the off-canvas to open.
     * @fires OffCanvas#opened
     */
    open(event, trigger) {
      if (this.$element.hasClass('is-open') || this.isRevealed) {
        return;
      }
      var _this = this;

      if (trigger) {
        this.$lastTrigger = trigger;
      }

      if (this.options.forceTo === 'top') {
        window.scrollTo(0, 0);
      } else if (this.options.forceTo === 'bottom') {
        window.scrollTo(0, document.body.scrollHeight);
      }

      /**
       * Fires when the off-canvas menu opens.
       * @event OffCanvas#opened
       */
      _this.$element.addClass('is-open');

      this.$triggers.attr('aria-expanded', 'true');
      this.$element.attr('aria-hidden', 'false').trigger('opened.zf.offcanvas');

      // If `contentScroll` is set to false, add class and disable scrolling on touch devices.
      if (this.options.contentScroll === false) {
        $('body').addClass('is-off-canvas-open').on('touchmove', this._stopScrolling);
      }

      if (this.options.contentOverlay === true) {
        this.$overlay.addClass('is-visible');
      }

      if (this.options.closeOnClick === true && this.options.contentOverlay === true) {
        this.$overlay.addClass('is-closable');
      }

      if (this.options.autoFocus === true) {
        this.$element.one(Foundation.transitionend(this.$element), function () {
          _this.$element.find('a, button').eq(0).focus();
        });
      }

      if (this.options.trapFocus === true) {
        this.$element.siblings('[data-off-canvas-content]').attr('tabindex', '-1');
        Foundation.Keyboard.trapFocus(this.$element);
      }
    }

    /**
     * Closes the off-canvas menu.
     * @function
     * @param {Function} cb - optional cb to fire after closure.
     * @fires OffCanvas#closed
     */
    close(cb) {
      if (!this.$element.hasClass('is-open') || this.isRevealed) {
        return;
      }

      var _this = this;

      _this.$element.removeClass('is-open');

      this.$element.attr('aria-hidden', 'true')
      /**
       * Fires when the off-canvas menu opens.
       * @event OffCanvas#closed
       */
      .trigger('closed.zf.offcanvas');

      // If `contentScroll` is set to false, remove class and re-enable scrolling on touch devices.
      if (this.options.contentScroll === false) {
        $('body').removeClass('is-off-canvas-open').off('touchmove', this._stopScrolling);
      }

      if (this.options.contentOverlay === true) {
        this.$overlay.removeClass('is-visible');
      }

      if (this.options.closeOnClick === true && this.options.contentOverlay === true) {
        this.$overlay.removeClass('is-closable');
      }

      this.$triggers.attr('aria-expanded', 'false');

      if (this.options.trapFocus === true) {
        this.$element.siblings('[data-off-canvas-content]').removeAttr('tabindex');
        Foundation.Keyboard.releaseFocus(this.$element);
      }
    }

    /**
     * Toggles the off-canvas menu open or closed.
     * @function
     * @param {Object} event - Event object passed from listener.
     * @param {jQuery} trigger - element that triggered the off-canvas to open.
     */
    toggle(event, trigger) {
      if (this.$element.hasClass('is-open')) {
        this.close(event, trigger);
      } else {
        this.open(event, trigger);
      }
    }

    /**
     * Handles keyboard input when detected. When the escape key is pressed, the off-canvas menu closes, and focus is restored to the element that opened the menu.
     * @function
     * @private
     */
    _handleKeyboard(e) {
      Foundation.Keyboard.handleKey(e, 'OffCanvas', {
        close: () => {
          this.close();
          this.$lastTrigger.focus();
          return true;
        },
        handled: () => {
          e.stopPropagation();
          e.preventDefault();
        }
      });
    }

    /**
     * Destroys the offcanvas plugin.
     * @function
     */
    destroy() {
      this.close();
      this.$element.off('.zf.trigger .zf.offcanvas');
      this.$overlay.off('.zf.offcanvas');

      Foundation.unregisterPlugin(this);
    }
  }

  OffCanvas.defaults = {
    /**
     * Allow the user to click outside of the menu to close it.
     * @option
     * @example true
     */
    closeOnClick: true,

    /**
     * Adds an overlay on top of `[data-off-canvas-content]`.
     * @option
     * @example true
     */
    contentOverlay: true,

    /**
     * Enable/disable scrolling of the main content when an off canvas panel is open.
     * @option
     * @example true
     */
    contentScroll: true,

    /**
     * Amount of time in ms the open and close transition requires. If none selected, pulls from body style.
     * @option
     * @example 500
     */
    transitionTime: 0,

    /**
     * Type of transition for the offcanvas menu. Options are 'push', 'detached' or 'slide'.
     * @option
     * @example push
     */
    transition: 'push',

    /**
     * Force the page to scroll to top or bottom on open.
     * @option
     * @example top
     */
    forceTo: null,

    /**
     * Allow the offcanvas to remain open for certain breakpoints.
     * @option
     * @example false
     */
    isRevealed: false,

    /**
     * Breakpoint at which to reveal. JS will use a RegExp to target standard classes, if changing classnames, pass your class with the `revealClass` option.
     * @option
     * @example reveal-for-large
     */
    revealOn: null,

    /**
     * Force focus to the offcanvas on open. If true, will focus the opening trigger on close.
     * @option
     * @example true
     */
    autoFocus: true,

    /**
     * Class used to force an offcanvas to remain open. Foundation defaults for this are `reveal-for-large` & `reveal-for-medium`.
     * @option
     * TODO improve the regex testing for this.
     * @example reveal-for-large
     */
    revealClass: 'reveal-for-',

    /**
     * Triggers optional focus trapping when opening an offcanvas. Sets tabindex of [data-off-canvas-content] to -1 for accessibility purposes.
     * @option
     * @example true
     */
    trapFocus: false
  };

  // Window exports
  Foundation.plugin(OffCanvas, 'OffCanvas');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Orbit module.
   * @module foundation.orbit
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   * @requires foundation.util.timerAndImageLoader
   * @requires foundation.util.touch
   */

  class Orbit {
    /**
    * Creates a new instance of an orbit carousel.
    * @class
    * @param {jQuery} element - jQuery object to make into an Orbit Carousel.
    * @param {Object} options - Overrides to the default plugin settings.
    */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Orbit.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Orbit');
      Foundation.Keyboard.register('Orbit', {
        'ltr': {
          'ARROW_RIGHT': 'next',
          'ARROW_LEFT': 'previous'
        },
        'rtl': {
          'ARROW_LEFT': 'next',
          'ARROW_RIGHT': 'previous'
        }
      });
    }

    /**
    * Initializes the plugin by creating jQuery collections, setting attributes, and starting the animation.
    * @function
    * @private
    */
    _init() {
      // @TODO: consider discussion on PR #9278 about DOM pollution by changeSlide
      this._reset();

      this.$wrapper = this.$element.find(`.${this.options.containerClass}`);
      this.$slides = this.$element.find(`.${this.options.slideClass}`);

      var $images = this.$element.find('img'),
          initActive = this.$slides.filter('.is-active'),
          id = this.$element[0].id || Foundation.GetYoDigits(6, 'orbit');

      this.$element.attr({
        'data-resize': id,
        'id': id
      });

      if (!initActive.length) {
        this.$slides.eq(0).addClass('is-active');
      }

      if (!this.options.useMUI) {
        this.$slides.addClass('no-motionui');
      }

      if ($images.length) {
        Foundation.onImagesLoaded($images, this._prepareForOrbit.bind(this));
      } else {
        this._prepareForOrbit(); //hehe
      }

      if (this.options.bullets) {
        this._loadBullets();
      }

      this._events();

      if (this.options.autoPlay && this.$slides.length > 1) {
        this.geoSync();
      }

      if (this.options.accessible) {
        // allow wrapper to be focusable to enable arrow navigation
        this.$wrapper.attr('tabindex', 0);
      }
    }

    /**
    * Creates a jQuery collection of bullets, if they are being used.
    * @function
    * @private
    */
    _loadBullets() {
      this.$bullets = this.$element.find(`.${this.options.boxOfBullets}`).find('button');
    }

    /**
    * Sets a `timer` object on the orbit, and starts the counter for the next slide.
    * @function
    */
    geoSync() {
      var _this = this;
      this.timer = new Foundation.Timer(this.$element, {
        duration: this.options.timerDelay,
        infinite: false
      }, function () {
        _this.changeSlide(true);
      });
      this.timer.start();
    }

    /**
    * Sets wrapper and slide heights for the orbit.
    * @function
    * @private
    */
    _prepareForOrbit() {
      var _this = this;
      this._setWrapperHeight();
    }

    /**
    * Calulates the height of each slide in the collection, and uses the tallest one for the wrapper height.
    * @function
    * @private
    * @param {Function} cb - a callback function to fire when complete.
    */
    _setWrapperHeight(cb) {
      //rewrite this to `for` loop
      var max = 0,
          temp,
          counter = 0,
          _this = this;

      this.$slides.each(function () {
        temp = this.getBoundingClientRect().height;
        $(this).attr('data-slide', counter);

        if (_this.$slides.filter('.is-active')[0] !== _this.$slides.eq(counter)[0]) {
          //if not the active slide, set css position and display property
          $(this).css({ 'position': 'relative', 'display': 'none' });
        }
        max = temp > max ? temp : max;
        counter++;
      });

      if (counter === this.$slides.length) {
        this.$wrapper.css({ 'height': max }); //only change the wrapper height property once.
        if (cb) {
          cb(max);
        } //fire callback with max height dimension.
      }
    }

    /**
    * Sets the max-height of each slide.
    * @function
    * @private
    */
    _setSlideHeight(height) {
      this.$slides.each(function () {
        $(this).css('max-height', height);
      });
    }

    /**
    * Adds event listeners to basically everything within the element.
    * @function
    * @private
    */
    _events() {
      var _this = this;

      //***************************************
      //**Now using custom event - thanks to:**
      //**      Yohai Ararat of Toronto      **
      //***************************************
      //
      this.$element.off('.resizeme.zf.trigger').on({
        'resizeme.zf.trigger': this._prepareForOrbit.bind(this)
      });
      if (this.$slides.length > 1) {

        if (this.options.swipe) {
          this.$slides.off('swipeleft.zf.orbit swiperight.zf.orbit').on('swipeleft.zf.orbit', function (e) {
            e.preventDefault();
            _this.changeSlide(true);
          }).on('swiperight.zf.orbit', function (e) {
            e.preventDefault();
            _this.changeSlide(false);
          });
        }
        //***************************************

        if (this.options.autoPlay) {
          this.$slides.on('click.zf.orbit', function () {
            _this.$element.data('clickedOn', _this.$element.data('clickedOn') ? false : true);
            _this.timer[_this.$element.data('clickedOn') ? 'pause' : 'start']();
          });

          if (this.options.pauseOnHover) {
            this.$element.on('mouseenter.zf.orbit', function () {
              _this.timer.pause();
            }).on('mouseleave.zf.orbit', function () {
              if (!_this.$element.data('clickedOn')) {
                _this.timer.start();
              }
            });
          }
        }

        if (this.options.navButtons) {
          var $controls = this.$element.find(`.${this.options.nextClass}, .${this.options.prevClass}`);
          $controls.attr('tabindex', 0)
          //also need to handle enter/return and spacebar key presses
          .on('click.zf.orbit touchend.zf.orbit', function (e) {
            e.preventDefault();
            _this.changeSlide($(this).hasClass(_this.options.nextClass));
          });
        }

        if (this.options.bullets) {
          this.$bullets.on('click.zf.orbit touchend.zf.orbit', function () {
            if (/is-active/g.test(this.className)) {
              return false;
            } //if this is active, kick out of function.
            var idx = $(this).data('slide'),
                ltr = idx > _this.$slides.filter('.is-active').data('slide'),
                $slide = _this.$slides.eq(idx);

            _this.changeSlide(ltr, $slide, idx);
          });
        }

        if (this.options.accessible) {
          this.$wrapper.add(this.$bullets).on('keydown.zf.orbit', function (e) {
            // handle keyboard event with keyboard util
            Foundation.Keyboard.handleKey(e, 'Orbit', {
              next: function () {
                _this.changeSlide(true);
              },
              previous: function () {
                _this.changeSlide(false);
              },
              handled: function () {
                // if bullet is focused, make sure focus moves
                if ($(e.target).is(_this.$bullets)) {
                  _this.$bullets.filter('.is-active').focus();
                }
              }
            });
          });
        }
      }
    }

    /**
     * Resets Orbit so it can be reinitialized
     */
    _reset() {
      // Don't do anything if there are no slides (first run)
      if (typeof this.$slides == 'undefined') {
        return;
      }

      if (this.$slides.length > 1) {
        // Remove old events
        this.$element.off('.zf.orbit').find('*').off('.zf.orbit');

        // Restart timer if autoPlay is enabled
        if (this.options.autoPlay) {
          this.timer.restart();
        }

        // Reset all sliddes
        this.$slides.each(function (el) {
          $(el).removeClass('is-active is-active is-in').removeAttr('aria-live').hide();
        });

        // Show the first slide
        this.$slides.first().addClass('is-active').show();

        // Triggers when the slide has finished animating
        this.$element.trigger('slidechange.zf.orbit', [this.$slides.first()]);

        // Select first bullet if bullets are present
        if (this.options.bullets) {
          this._updateBullets(0);
        }
      }
    }

    /**
    * Changes the current slide to a new one.
    * @function
    * @param {Boolean} isLTR - flag if the slide should move left to right.
    * @param {jQuery} chosenSlide - the jQuery element of the slide to show next, if one is selected.
    * @param {Number} idx - the index of the new slide in its collection, if one chosen.
    * @fires Orbit#slidechange
    */
    changeSlide(isLTR, chosenSlide, idx) {
      if (!this.$slides) {
        return;
      } // Don't freak out if we're in the middle of cleanup
      var $curSlide = this.$slides.filter('.is-active').eq(0);

      if (/mui/g.test($curSlide[0].className)) {
        return false;
      } //if the slide is currently animating, kick out of the function

      var $firstSlide = this.$slides.first(),
          $lastSlide = this.$slides.last(),
          dirIn = isLTR ? 'Right' : 'Left',
          dirOut = isLTR ? 'Left' : 'Right',
          _this = this,
          $newSlide;

      if (!chosenSlide) {
        //most of the time, this will be auto played or clicked from the navButtons.
        $newSlide = isLTR ? //if wrapping enabled, check to see if there is a `next` or `prev` sibling, if not, select the first or last slide to fill in. if wrapping not enabled, attempt to select `next` or `prev`, if there's nothing there, the function will kick out on next step. CRAZY NESTED TERNARIES!!!!!
        this.options.infiniteWrap ? $curSlide.next(`.${this.options.slideClass}`).length ? $curSlide.next(`.${this.options.slideClass}`) : $firstSlide : $curSlide.next(`.${this.options.slideClass}`) : //pick next slide if moving left to right
        this.options.infiniteWrap ? $curSlide.prev(`.${this.options.slideClass}`).length ? $curSlide.prev(`.${this.options.slideClass}`) : $lastSlide : $curSlide.prev(`.${this.options.slideClass}`); //pick prev slide if moving right to left
      } else {
        $newSlide = chosenSlide;
      }

      if ($newSlide.length) {
        /**
        * Triggers before the next slide starts animating in and only if a next slide has been found.
        * @event Orbit#beforeslidechange
        */
        this.$element.trigger('beforeslidechange.zf.orbit', [$curSlide, $newSlide]);

        if (this.options.bullets) {
          idx = idx || this.$slides.index($newSlide); //grab index to update bullets
          this._updateBullets(idx);
        }

        if (this.options.useMUI && !this.$element.is(':hidden')) {
          Foundation.Motion.animateIn($newSlide.addClass('is-active').css({ 'position': 'absolute', 'top': 0 }), this.options[`animInFrom${dirIn}`], function () {
            $newSlide.css({ 'position': 'relative', 'display': 'block' }).attr('aria-live', 'polite');
          });

          Foundation.Motion.animateOut($curSlide.removeClass('is-active'), this.options[`animOutTo${dirOut}`], function () {
            $curSlide.removeAttr('aria-live');
            if (_this.options.autoPlay && !_this.timer.isPaused) {
              _this.timer.restart();
            }
            //do stuff?
          });
        } else {
          $curSlide.removeClass('is-active is-in').removeAttr('aria-live').hide();
          $newSlide.addClass('is-active is-in').attr('aria-live', 'polite').show();
          if (this.options.autoPlay && !this.timer.isPaused) {
            this.timer.restart();
          }
        }
        /**
        * Triggers when the slide has finished animating in.
        * @event Orbit#slidechange
        */
        this.$element.trigger('slidechange.zf.orbit', [$newSlide]);
      }
    }

    /**
    * Updates the active state of the bullets, if displayed.
    * @function
    * @private
    * @param {Number} idx - the index of the current slide.
    */
    _updateBullets(idx) {
      var $oldBullet = this.$element.find(`.${this.options.boxOfBullets}`).find('.is-active').removeClass('is-active').blur(),
          span = $oldBullet.find('span:last').detach(),
          $newBullet = this.$bullets.eq(idx).addClass('is-active').append(span);
    }

    /**
    * Destroys the carousel and hides the element.
    * @function
    */
    destroy() {
      this.$element.off('.zf.orbit').find('*').off('.zf.orbit').end().hide();
      Foundation.unregisterPlugin(this);
    }
  }

  Orbit.defaults = {
    /**
    * Tells the JS to look for and loadBullets.
    * @option
    * @example true
    */
    bullets: true,
    /**
    * Tells the JS to apply event listeners to nav buttons
    * @option
    * @example true
    */
    navButtons: true,
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-in-right'
    */
    animInFromRight: 'slide-in-right',
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-out-right'
    */
    animOutToRight: 'slide-out-right',
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-in-left'
    *
    */
    animInFromLeft: 'slide-in-left',
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-out-left'
    */
    animOutToLeft: 'slide-out-left',
    /**
    * Allows Orbit to automatically animate on page load.
    * @option
    * @example true
    */
    autoPlay: true,
    /**
    * Amount of time, in ms, between slide transitions
    * @option
    * @example 5000
    */
    timerDelay: 5000,
    /**
    * Allows Orbit to infinitely loop through the slides
    * @option
    * @example true
    */
    infiniteWrap: true,
    /**
    * Allows the Orbit slides to bind to swipe events for mobile, requires an additional util library
    * @option
    * @example true
    */
    swipe: true,
    /**
    * Allows the timing function to pause animation on hover.
    * @option
    * @example true
    */
    pauseOnHover: true,
    /**
    * Allows Orbit to bind keyboard events to the slider, to animate frames with arrow keys
    * @option
    * @example true
    */
    accessible: true,
    /**
    * Class applied to the container of Orbit
    * @option
    * @example 'orbit-container'
    */
    containerClass: 'orbit-container',
    /**
    * Class applied to individual slides.
    * @option
    * @example 'orbit-slide'
    */
    slideClass: 'orbit-slide',
    /**
    * Class applied to the bullet container. You're welcome.
    * @option
    * @example 'orbit-bullets'
    */
    boxOfBullets: 'orbit-bullets',
    /**
    * Class applied to the `next` navigation button.
    * @option
    * @example 'orbit-next'
    */
    nextClass: 'orbit-next',
    /**
    * Class applied to the `previous` navigation button.
    * @option
    * @example 'orbit-previous'
    */
    prevClass: 'orbit-previous',
    /**
    * Boolean to flag the js to use motion ui classes or not. Default to true for backwards compatability.
    * @option
    * @example true
    */
    useMUI: true
  };

  // Window exports
  Foundation.plugin(Orbit, 'Orbit');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * ResponsiveMenu module.
   * @module foundation.responsiveMenu
   * @requires foundation.util.triggers
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.accordionMenu
   * @requires foundation.util.drilldown
   * @requires foundation.util.dropdown-menu
   */

  class ResponsiveMenu {
    /**
     * Creates a new instance of a responsive menu.
     * @class
     * @fires ResponsiveMenu#init
     * @param {jQuery} element - jQuery object to make into a dropdown menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = $(element);
      this.rules = this.$element.data('responsive-menu');
      this.currentMq = null;
      this.currentPlugin = null;

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'ResponsiveMenu');
    }

    /**
     * Initializes the Menu by parsing the classes from the 'data-ResponsiveMenu' attribute on the element.
     * @function
     * @private
     */
    _init() {
      // The first time an Interchange plugin is initialized, this.rules is converted from a string of "classes" to an object of rules
      if (typeof this.rules === 'string') {
        let rulesTree = {};

        // Parse rules from "classes" pulled from data attribute
        let rules = this.rules.split(' ');

        // Iterate through every rule found
        for (let i = 0; i < rules.length; i++) {
          let rule = rules[i].split('-');
          let ruleSize = rule.length > 1 ? rule[0] : 'small';
          let rulePlugin = rule.length > 1 ? rule[1] : rule[0];

          if (MenuPlugins[rulePlugin] !== null) {
            rulesTree[ruleSize] = MenuPlugins[rulePlugin];
          }
        }

        this.rules = rulesTree;
      }

      if (!$.isEmptyObject(this.rules)) {
        this._checkMediaQueries();
      }
      // Add data-mutate since children may need it.
      this.$element.attr('data-mutate', this.$element.attr('data-mutate') || Foundation.GetYoDigits(6, 'responsive-menu'));
    }

    /**
     * Initializes events for the Menu.
     * @function
     * @private
     */
    _events() {
      var _this = this;

      $(window).on('changed.zf.mediaquery', function () {
        _this._checkMediaQueries();
      });
      // $(window).on('resize.zf.ResponsiveMenu', function() {
      //   _this._checkMediaQueries();
      // });
    }

    /**
     * Checks the current screen width against available media queries. If the media query has changed, and the plugin needed has changed, the plugins will swap out.
     * @function
     * @private
     */
    _checkMediaQueries() {
      var matchedMq,
          _this = this;
      // Iterate through each rule and find the last matching rule
      $.each(this.rules, function (key) {
        if (Foundation.MediaQuery.atLeast(key)) {
          matchedMq = key;
        }
      });

      // No match? No dice
      if (!matchedMq) return;

      // Plugin already initialized? We good
      if (this.currentPlugin instanceof this.rules[matchedMq].plugin) return;

      // Remove existing plugin-specific CSS classes
      $.each(MenuPlugins, function (key, value) {
        _this.$element.removeClass(value.cssClass);
      });

      // Add the CSS class for the new plugin
      this.$element.addClass(this.rules[matchedMq].cssClass);

      // Create an instance of the new plugin
      if (this.currentPlugin) this.currentPlugin.destroy();
      this.currentPlugin = new this.rules[matchedMq].plugin(this.$element, {});
    }

    /**
     * Destroys the instance of the current plugin on this element, as well as the window resize handler that switches the plugins out.
     * @function
     */
    destroy() {
      this.currentPlugin.destroy();
      $(window).off('.zf.ResponsiveMenu');
      Foundation.unregisterPlugin(this);
    }
  }

  ResponsiveMenu.defaults = {};

  // The plugin matches the plugin classes with these plugin instances.
  var MenuPlugins = {
    dropdown: {
      cssClass: 'dropdown',
      plugin: Foundation._plugins['dropdown-menu'] || null
    },
    drilldown: {
      cssClass: 'drilldown',
      plugin: Foundation._plugins['drilldown'] || null
    },
    accordion: {
      cssClass: 'accordion-menu',
      plugin: Foundation._plugins['accordion-menu'] || null
    }
  };

  // Window exports
  Foundation.plugin(ResponsiveMenu, 'ResponsiveMenu');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * ResponsiveToggle module.
   * @module foundation.responsiveToggle
   * @requires foundation.util.mediaQuery
   */

  class ResponsiveToggle {
    /**
     * Creates a new instance of Tab Bar.
     * @class
     * @fires ResponsiveToggle#init
     * @param {jQuery} element - jQuery object to attach tab bar functionality to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = $(element);
      this.options = $.extend({}, ResponsiveToggle.defaults, this.$element.data(), options);

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'ResponsiveToggle');
    }

    /**
     * Initializes the tab bar by finding the target element, toggling element, and running update().
     * @function
     * @private
     */
    _init() {
      var targetID = this.$element.data('responsive-toggle');
      if (!targetID) {
        console.error('Your tab bar needs an ID of a Menu as the value of data-tab-bar.');
      }

      this.$targetMenu = $(`#${targetID}`);
      this.$toggler = this.$element.find('[data-toggle]');
      this.options = $.extend({}, this.options, this.$targetMenu.data());

      // If they were set, parse the animation classes
      if (this.options.animate) {
        let input = this.options.animate.split(' ');

        this.animationIn = input[0];
        this.animationOut = input[1] || null;
      }

      this._update();
    }

    /**
     * Adds necessary event handlers for the tab bar to work.
     * @function
     * @private
     */
    _events() {
      var _this = this;

      this._updateMqHandler = this._update.bind(this);

      $(window).on('changed.zf.mediaquery', this._updateMqHandler);

      this.$toggler.on('click.zf.responsiveToggle', this.toggleMenu.bind(this));
    }

    /**
     * Checks the current media query to determine if the tab bar should be visible or hidden.
     * @function
     * @private
     */
    _update() {
      // Mobile
      if (!Foundation.MediaQuery.atLeast(this.options.hideFor)) {
        this.$element.show();
        this.$targetMenu.hide();
      }

      // Desktop
      else {
          this.$element.hide();
          this.$targetMenu.show();
        }
    }

    /**
     * Toggles the element attached to the tab bar. The toggle only happens if the screen is small enough to allow it.
     * @function
     * @fires ResponsiveToggle#toggled
     */
    toggleMenu() {
      if (!Foundation.MediaQuery.atLeast(this.options.hideFor)) {
        if (this.options.animate) {
          if (this.$targetMenu.is(':hidden')) {
            Foundation.Motion.animateIn(this.$targetMenu, this.animationIn, () => {
              /**
               * Fires when the element attached to the tab bar toggles.
               * @event ResponsiveToggle#toggled
               */
              this.$element.trigger('toggled.zf.responsiveToggle');
              this.$targetMenu.find('[data-mutate]').triggerHandler('mutateme.zf.trigger');
            });
          } else {
            Foundation.Motion.animateOut(this.$targetMenu, this.animationOut, () => {
              /**
               * Fires when the element attached to the tab bar toggles.
               * @event ResponsiveToggle#toggled
               */
              this.$element.trigger('toggled.zf.responsiveToggle');
            });
          }
        } else {
          this.$targetMenu.toggle(0);
          this.$targetMenu.find('[data-mutate]').trigger('mutateme.zf.trigger');

          /**
           * Fires when the element attached to the tab bar toggles.
           * @event ResponsiveToggle#toggled
           */
          this.$element.trigger('toggled.zf.responsiveToggle');
        }
      }
    }

    destroy() {
      this.$element.off('.zf.responsiveToggle');
      this.$toggler.off('.zf.responsiveToggle');

      $(window).off('changed.zf.mediaquery', this._updateMqHandler);

      Foundation.unregisterPlugin(this);
    }
  }

  ResponsiveToggle.defaults = {
    /**
     * The breakpoint after which the menu is always shown, and the tab bar is hidden.
     * @option
     * @example 'medium'
     */
    hideFor: 'medium',

    /**
     * To decide if the toggle should be animated or not.
     * @option
     * @example false
     */
    animate: false
  };

  // Window exports
  Foundation.plugin(ResponsiveToggle, 'ResponsiveToggle');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Reveal module.
   * @module foundation.reveal
   * @requires foundation.util.keyboard
   * @requires foundation.util.box
   * @requires foundation.util.triggers
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.motion if using animations
   */

  class Reveal {
    /**
     * Creates a new instance of Reveal.
     * @class
     * @param {jQuery} element - jQuery object to use for the modal.
     * @param {Object} options - optional parameters.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Reveal.defaults, this.$element.data(), options);
      this._init();

      Foundation.registerPlugin(this, 'Reveal');
      Foundation.Keyboard.register('Reveal', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the modal by adding the overlay and close buttons, (if selected).
     * @private
     */
    _init() {
      this.id = this.$element.attr('id');
      this.isActive = false;
      this.cached = { mq: Foundation.MediaQuery.current };
      this.isMobile = mobileSniff();

      this.$anchor = $(`[data-open="${this.id}"]`).length ? $(`[data-open="${this.id}"]`) : $(`[data-toggle="${this.id}"]`);
      this.$anchor.attr({
        'aria-controls': this.id,
        'aria-haspopup': true,
        'tabindex': 0
      });

      if (this.options.fullScreen || this.$element.hasClass('full')) {
        this.options.fullScreen = true;
        this.options.overlay = false;
      }
      if (this.options.overlay && !this.$overlay) {
        this.$overlay = this._makeOverlay(this.id);
      }

      this.$element.attr({
        'role': 'dialog',
        'aria-hidden': true,
        'data-yeti-box': this.id,
        'data-resize': this.id
      });

      if (this.$overlay) {
        this.$element.detach().appendTo(this.$overlay);
      } else {
        this.$element.detach().appendTo($(this.options.appendTo));
        this.$element.addClass('without-overlay');
      }
      this._events();
      if (this.options.deepLink && window.location.hash === `#${this.id}`) {
        $(window).one('load.zf.reveal', this.open.bind(this));
      }
    }

    /**
     * Creates an overlay div to display behind the modal.
     * @private
     */
    _makeOverlay() {
      return $('<div></div>').addClass('reveal-overlay').appendTo(this.options.appendTo);
    }

    /**
     * Updates position of modal
     * TODO:  Figure out if we actually need to cache these values or if it doesn't matter
     * @private
     */
    _updatePosition() {
      var width = this.$element.outerWidth();
      var outerWidth = $(window).width();
      var height = this.$element.outerHeight();
      var outerHeight = $(window).height();
      var left, top;
      if (this.options.hOffset === 'auto') {
        left = parseInt((outerWidth - width) / 2, 10);
      } else {
        left = parseInt(this.options.hOffset, 10);
      }
      if (this.options.vOffset === 'auto') {
        if (height > outerHeight) {
          top = parseInt(Math.min(100, outerHeight / 10), 10);
        } else {
          top = parseInt((outerHeight - height) / 4, 10);
        }
      } else {
        top = parseInt(this.options.vOffset, 10);
      }
      this.$element.css({ top: top + 'px' });
      // only worry about left if we don't have an overlay or we havea  horizontal offset,
      // otherwise we're perfectly in the middle
      if (!this.$overlay || this.options.hOffset !== 'auto') {
        this.$element.css({ left: left + 'px' });
        this.$element.css({ margin: '0px' });
      }
    }

    /**
     * Adds event handlers for the modal.
     * @private
     */
    _events() {
      var _this = this;

      this.$element.on({
        'open.zf.trigger': this.open.bind(this),
        'close.zf.trigger': (event, $element) => {
          if (event.target === _this.$element[0] || $(event.target).parents('[data-closable]')[0] === $element) {
            // only close reveal when it's explicitly called
            return this.close.apply(this);
          }
        },
        'toggle.zf.trigger': this.toggle.bind(this),
        'resizeme.zf.trigger': function () {
          _this._updatePosition();
        }
      });

      if (this.$anchor.length) {
        this.$anchor.on('keydown.zf.reveal', function (e) {
          if (e.which === 13 || e.which === 32) {
            e.stopPropagation();
            e.preventDefault();
            _this.open();
          }
        });
      }

      if (this.options.closeOnClick && this.options.overlay) {
        this.$overlay.off('.zf.reveal').on('click.zf.reveal', function (e) {
          if (e.target === _this.$element[0] || $.contains(_this.$element[0], e.target) || !$.contains(document, e.target)) {
            return;
          }
          _this.close();
        });
      }
      if (this.options.deepLink) {
        $(window).on(`popstate.zf.reveal:${this.id}`, this._handleState.bind(this));
      }
    }

    /**
     * Handles modal methods on back/forward button clicks or any other event that triggers popstate.
     * @private
     */
    _handleState(e) {
      if (window.location.hash === '#' + this.id && !this.isActive) {
        this.open();
      } else {
        this.close();
      }
    }

    /**
     * Opens the modal controlled by `this.$anchor`, and closes all others by default.
     * @function
     * @fires Reveal#closeme
     * @fires Reveal#open
     */
    open() {
      if (this.options.deepLink) {
        var hash = `#${this.id}`;

        if (window.history.pushState) {
          window.history.pushState(null, null, hash);
        } else {
          window.location.hash = hash;
        }
      }

      this.isActive = true;

      // Make elements invisible, but remove display: none so we can get size and positioning
      this.$element.css({ 'visibility': 'hidden' }).show().scrollTop(0);
      if (this.options.overlay) {
        this.$overlay.css({ 'visibility': 'hidden' }).show();
      }

      this._updatePosition();

      this.$element.hide().css({ 'visibility': '' });

      if (this.$overlay) {
        this.$overlay.css({ 'visibility': '' }).hide();
        if (this.$element.hasClass('fast')) {
          this.$overlay.addClass('fast');
        } else if (this.$element.hasClass('slow')) {
          this.$overlay.addClass('slow');
        }
      }

      if (!this.options.multipleOpened) {
        /**
         * Fires immediately before the modal opens.
         * Closes any other modals that are currently open
         * @event Reveal#closeme
         */
        this.$element.trigger('closeme.zf.reveal', this.id);
      }

      var _this = this;

      function addRevealOpenClasses() {
        if (_this.isMobile) {
          if (!_this.originalScrollPos) {
            _this.originalScrollPos = window.pageYOffset;
          }
          $('html, body').addClass('is-reveal-open');
        } else {
          $('body').addClass('is-reveal-open');
        }
      }
      // Motion UI method of reveal
      if (this.options.animationIn) {
        function afterAnimation() {
          _this.$element.attr({
            'aria-hidden': false,
            'tabindex': -1
          }).focus();
          addRevealOpenClasses();
          Foundation.Keyboard.trapFocus(_this.$element);
        }
        if (this.options.overlay) {
          Foundation.Motion.animateIn(this.$overlay, 'fade-in');
        }
        Foundation.Motion.animateIn(this.$element, this.options.animationIn, () => {
          if (this.$element) {
            // protect against object having been removed
            this.focusableElements = Foundation.Keyboard.findFocusable(this.$element);
            afterAnimation();
          }
        });
      }
      // jQuery method of reveal
      else {
          if (this.options.overlay) {
            this.$overlay.show(0);
          }
          this.$element.show(this.options.showDelay);
        }

      // handle accessibility
      this.$element.attr({
        'aria-hidden': false,
        'tabindex': -1
      }).focus();
      Foundation.Keyboard.trapFocus(this.$element);

      /**
       * Fires when the modal has successfully opened.
       * @event Reveal#open
       */
      this.$element.trigger('open.zf.reveal');

      addRevealOpenClasses();

      setTimeout(() => {
        this._extraHandlers();
      }, 0);
    }

    /**
     * Adds extra event handlers for the body and window if necessary.
     * @private
     */
    _extraHandlers() {
      var _this = this;
      if (!this.$element) {
        return;
      } // If we're in the middle of cleanup, don't freak out
      this.focusableElements = Foundation.Keyboard.findFocusable(this.$element);

      if (!this.options.overlay && this.options.closeOnClick && !this.options.fullScreen) {
        $('body').on('click.zf.reveal', function (e) {
          if (e.target === _this.$element[0] || $.contains(_this.$element[0], e.target) || !$.contains(document, e.target)) {
            return;
          }
          _this.close();
        });
      }

      if (this.options.closeOnEsc) {
        $(window).on('keydown.zf.reveal', function (e) {
          Foundation.Keyboard.handleKey(e, 'Reveal', {
            close: function () {
              if (_this.options.closeOnEsc) {
                _this.close();
                _this.$anchor.focus();
              }
            }
          });
        });
      }

      // lock focus within modal while tabbing
      this.$element.on('keydown.zf.reveal', function (e) {
        var $target = $(this);
        // handle keyboard event with keyboard util
        Foundation.Keyboard.handleKey(e, 'Reveal', {
          open: function () {
            if (_this.$element.find(':focus').is(_this.$element.find('[data-close]'))) {
              setTimeout(function () {
                // set focus back to anchor if close button has been activated
                _this.$anchor.focus();
              }, 1);
            } else if ($target.is(_this.focusableElements)) {
              // dont't trigger if acual element has focus (i.e. inputs, links, ...)
              _this.open();
            }
          },
          close: function () {
            if (_this.options.closeOnEsc) {
              _this.close();
              _this.$anchor.focus();
            }
          },
          handled: function (preventDefault) {
            if (preventDefault) {
              e.preventDefault();
            }
          }
        });
      });
    }

    /**
     * Closes the modal.
     * @function
     * @fires Reveal#closed
     */
    close() {
      if (!this.isActive || !this.$element.is(':visible')) {
        return false;
      }
      var _this = this;

      // Motion UI method of hiding
      if (this.options.animationOut) {
        if (this.options.overlay) {
          Foundation.Motion.animateOut(this.$overlay, 'fade-out', finishUp);
        } else {
          finishUp();
        }

        Foundation.Motion.animateOut(this.$element, this.options.animationOut);
      }
      // jQuery method of hiding
      else {
          if (this.options.overlay) {
            this.$overlay.hide(0, finishUp);
          } else {
            finishUp();
          }

          this.$element.hide(this.options.hideDelay);
        }

      // Conditionals to remove extra event listeners added on open
      if (this.options.closeOnEsc) {
        $(window).off('keydown.zf.reveal');
      }

      if (!this.options.overlay && this.options.closeOnClick) {
        $('body').off('click.zf.reveal');
      }

      this.$element.off('keydown.zf.reveal');

      function finishUp() {
        if (_this.isMobile) {
          $('html, body').removeClass('is-reveal-open');
          if (_this.originalScrollPos) {
            $('body').scrollTop(_this.originalScrollPos);
            _this.originalScrollPos = null;
          }
        } else {
          $('body').removeClass('is-reveal-open');
        }

        Foundation.Keyboard.releaseFocus(_this.$element);

        _this.$element.attr('aria-hidden', true);

        /**
        * Fires when the modal is done closing.
        * @event Reveal#closed
        */
        _this.$element.trigger('closed.zf.reveal');
      }

      /**
      * Resets the modal content
      * This prevents a running video to keep going in the background
      */
      if (this.options.resetOnClose) {
        this.$element.html(this.$element.html());
      }

      this.isActive = false;
      if (_this.options.deepLink) {
        if (window.history.replaceState) {
          window.history.replaceState('', document.title, window.location.href.replace(`#${this.id}`, ''));
        } else {
          window.location.hash = '';
        }
      }
    }

    /**
     * Toggles the open/closed state of a modal.
     * @function
     */
    toggle() {
      if (this.isActive) {
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Destroys an instance of a modal.
     * @function
     */
    destroy() {
      if (this.options.overlay) {
        this.$element.appendTo($(this.options.appendTo)); // move $element outside of $overlay to prevent error unregisterPlugin()
        this.$overlay.hide().off().remove();
      }
      this.$element.hide().off();
      this.$anchor.off('.zf');
      $(window).off(`.zf.reveal:${this.id}`);

      Foundation.unregisterPlugin(this);
    }
  }

  Reveal.defaults = {
    /**
     * Motion-UI class to use for animated elements. If none used, defaults to simple show/hide.
     * @option
     * @example 'slide-in-left'
     */
    animationIn: '',
    /**
     * Motion-UI class to use for animated elements. If none used, defaults to simple show/hide.
     * @option
     * @example 'slide-out-right'
     */
    animationOut: '',
    /**
     * Time, in ms, to delay the opening of a modal after a click if no animation used.
     * @option
     * @example 10
     */
    showDelay: 0,
    /**
     * Time, in ms, to delay the closing of a modal after a click if no animation used.
     * @option
     * @example 10
     */
    hideDelay: 0,
    /**
     * Allows a click on the body/overlay to close the modal.
     * @option
     * @example true
     */
    closeOnClick: true,
    /**
     * Allows the modal to close if the user presses the `ESCAPE` key.
     * @option
     * @example true
     */
    closeOnEsc: true,
    /**
     * If true, allows multiple modals to be displayed at once.
     * @option
     * @example false
     */
    multipleOpened: false,
    /**
     * Distance, in pixels, the modal should push down from the top of the screen.
     * @option
     * @example auto
     */
    vOffset: 'auto',
    /**
     * Distance, in pixels, the modal should push in from the side of the screen.
     * @option
     * @example auto
     */
    hOffset: 'auto',
    /**
     * Allows the modal to be fullscreen, completely blocking out the rest of the view. JS checks for this as well.
     * @option
     * @example false
     */
    fullScreen: false,
    /**
     * Percentage of screen height the modal should push up from the bottom of the view.
     * @option
     * @example 10
     */
    btmOffsetPct: 10,
    /**
     * Allows the modal to generate an overlay div, which will cover the view when modal opens.
     * @option
     * @example true
     */
    overlay: true,
    /**
     * Allows the modal to remove and reinject markup on close. Should be true if using video elements w/o using provider's api, otherwise, videos will continue to play in the background.
     * @option
     * @example false
     */
    resetOnClose: false,
    /**
     * Allows the modal to alter the url on open/close, and allows the use of the `back` button to close modals. ALSO, allows a modal to auto-maniacally open on page load IF the hash === the modal's user-set id.
     * @option
     * @example false
     */
    deepLink: false,
    /**
    * Allows the modal to append to custom div.
    * @option
    * @example false
    */
    appendTo: "body"

  };

  // Window exports
  Foundation.plugin(Reveal, 'Reveal');

  function iPhoneSniff() {
    return (/iP(ad|hone|od).*OS/.test(window.navigator.userAgent)
    );
  }

  function androidSniff() {
    return (/Android/.test(window.navigator.userAgent)
    );
  }

  function mobileSniff() {
    return iPhoneSniff() || androidSniff();
  }
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Slider module.
   * @module foundation.slider
   * @requires foundation.util.motion
   * @requires foundation.util.triggers
   * @requires foundation.util.keyboard
   * @requires foundation.util.touch
   */

  class Slider {
    /**
     * Creates a new instance of a slider control.
     * @class
     * @param {jQuery} element - jQuery object to make into a slider control.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Slider.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Slider');
      Foundation.Keyboard.register('Slider', {
        'ltr': {
          'ARROW_RIGHT': 'increase',
          'ARROW_UP': 'increase',
          'ARROW_DOWN': 'decrease',
          'ARROW_LEFT': 'decrease',
          'SHIFT_ARROW_RIGHT': 'increase_fast',
          'SHIFT_ARROW_UP': 'increase_fast',
          'SHIFT_ARROW_DOWN': 'decrease_fast',
          'SHIFT_ARROW_LEFT': 'decrease_fast'
        },
        'rtl': {
          'ARROW_LEFT': 'increase',
          'ARROW_RIGHT': 'decrease',
          'SHIFT_ARROW_LEFT': 'increase_fast',
          'SHIFT_ARROW_RIGHT': 'decrease_fast'
        }
      });
    }

    /**
     * Initilizes the plugin by reading/setting attributes, creating collections and setting the initial position of the handle(s).
     * @function
     * @private
     */
    _init() {
      this.inputs = this.$element.find('input');
      this.handles = this.$element.find('[data-slider-handle]');

      this.$handle = this.handles.eq(0);
      this.$input = this.inputs.length ? this.inputs.eq(0) : $(`#${this.$handle.attr('aria-controls')}`);
      this.$fill = this.$element.find('[data-slider-fill]').css(this.options.vertical ? 'height' : 'width', 0);

      var isDbl = false,
          _this = this;
      if (this.options.disabled || this.$element.hasClass(this.options.disabledClass)) {
        this.options.disabled = true;
        this.$element.addClass(this.options.disabledClass);
      }
      if (!this.inputs.length) {
        this.inputs = $().add(this.$input);
        this.options.binding = true;
      }

      this._setInitAttr(0);

      if (this.handles[1]) {
        this.options.doubleSided = true;
        this.$handle2 = this.handles.eq(1);
        this.$input2 = this.inputs.length > 1 ? this.inputs.eq(1) : $(`#${this.$handle2.attr('aria-controls')}`);

        if (!this.inputs[1]) {
          this.inputs = this.inputs.add(this.$input2);
        }
        isDbl = true;

        // this.$handle.triggerHandler('click.zf.slider');
        this._setInitAttr(1);
      }

      // Set handle positions
      this.setHandles();

      this._events();
    }

    setHandles() {
      if (this.handles[1]) {
        this._setHandlePos(this.$handle, this.inputs.eq(0).val(), true, () => {
          this._setHandlePos(this.$handle2, this.inputs.eq(1).val(), true);
        });
      } else {
        this._setHandlePos(this.$handle, this.inputs.eq(0).val(), true);
      }
    }

    _reflow() {
      this.setHandles();
    }
    /**
    * @function
    * @private
    * @param {Number} value - floating point (the value) to be transformed using to a relative position on the slider (the inverse of _value)
    */
    _pctOfBar(value) {
      var pctOfBar = percent(value - this.options.start, this.options.end - this.options.start);

      switch (this.options.positionValueFunction) {
        case "pow":
          pctOfBar = this._logTransform(pctOfBar);
          break;
        case "log":
          pctOfBar = this._powTransform(pctOfBar);
          break;
      }

      return pctOfBar.toFixed(2);
    }

    /**
    * @function
    * @private
    * @param {Number} pctOfBar - floating point, the relative position of the slider (typically between 0-1) to be transformed to a value
    */
    _value(pctOfBar) {
      switch (this.options.positionValueFunction) {
        case "pow":
          pctOfBar = this._powTransform(pctOfBar);
          break;
        case "log":
          pctOfBar = this._logTransform(pctOfBar);
          break;
      }
      var value = (this.options.end - this.options.start) * pctOfBar + this.options.start;

      return value;
    }

    /**
    * @function
    * @private
    * @param {Number} value - floating point (typically between 0-1) to be transformed using the log function
    */
    _logTransform(value) {
      return baseLog(this.options.nonLinearBase, value * (this.options.nonLinearBase - 1) + 1);
    }

    /**
    * @function
    * @private
    * @param {Number} value - floating point (typically between 0-1) to be transformed using the power function
    */
    _powTransform(value) {
      return (Math.pow(this.options.nonLinearBase, value) - 1) / (this.options.nonLinearBase - 1);
    }

    /**
     * Sets the position of the selected handle and fill bar.
     * @function
     * @private
     * @param {jQuery} $hndl - the selected handle to move.
     * @param {Number} location - floating point between the start and end values of the slider bar.
     * @param {Function} cb - callback function to fire on completion.
     * @fires Slider#moved
     * @fires Slider#changed
     */
    _setHandlePos($hndl, location, noInvert, cb) {
      // don't move if the slider has been disabled since its initialization
      if (this.$element.hasClass(this.options.disabledClass)) {
        return;
      }
      //might need to alter that slightly for bars that will have odd number selections.
      location = parseFloat(location); //on input change events, convert string to number...grumble.

      // prevent slider from running out of bounds, if value exceeds the limits set through options, override the value to min/max
      if (location < this.options.start) {
        location = this.options.start;
      } else if (location > this.options.end) {
        location = this.options.end;
      }

      var isDbl = this.options.doubleSided;

      if (isDbl) {
        //this block is to prevent 2 handles from crossing eachother. Could/should be improved.
        if (this.handles.index($hndl) === 0) {
          var h2Val = parseFloat(this.$handle2.attr('aria-valuenow'));
          location = location >= h2Val ? h2Val - this.options.step : location;
        } else {
          var h1Val = parseFloat(this.$handle.attr('aria-valuenow'));
          location = location <= h1Val ? h1Val + this.options.step : location;
        }
      }

      //this is for single-handled vertical sliders, it adjusts the value to account for the slider being "upside-down"
      //for click and drag events, it's weird due to the scale(-1, 1) css property
      if (this.options.vertical && !noInvert) {
        location = this.options.end - location;
      }

      var _this = this,
          vert = this.options.vertical,
          hOrW = vert ? 'height' : 'width',
          lOrT = vert ? 'top' : 'left',
          handleDim = $hndl[0].getBoundingClientRect()[hOrW],
          elemDim = this.$element[0].getBoundingClientRect()[hOrW],

      //percentage of bar min/max value based on click or drag point
      pctOfBar = this._pctOfBar(location),

      //number of actual pixels to shift the handle, based on the percentage obtained above
      pxToMove = (elemDim - handleDim) * pctOfBar,

      //percentage of bar to shift the handle
      movement = (percent(pxToMove, elemDim) * 100).toFixed(this.options.decimal);
      //fixing the decimal value for the location number, is passed to other methods as a fixed floating-point value
      location = parseFloat(location.toFixed(this.options.decimal));
      // declare empty object for css adjustments, only used with 2 handled-sliders
      var css = {};

      this._setValues($hndl, location);

      // TODO update to calculate based on values set to respective inputs??
      if (isDbl) {
        var isLeftHndl = this.handles.index($hndl) === 0,

        //empty variable, will be used for min-height/width for fill bar
        dim,

        //percentage w/h of the handle compared to the slider bar
        handlePct = ~~(percent(handleDim, elemDim) * 100);
        //if left handle, the math is slightly different than if it's the right handle, and the left/top property needs to be changed for the fill bar
        if (isLeftHndl) {
          //left or top percentage value to apply to the fill bar.
          css[lOrT] = `${movement}%`;
          //calculate the new min-height/width for the fill bar.
          dim = parseFloat(this.$handle2[0].style[lOrT]) - movement + handlePct;
          //this callback is necessary to prevent errors and allow the proper placement and initialization of a 2-handled slider
          //plus, it means we don't care if 'dim' isNaN on init, it won't be in the future.
          if (cb && typeof cb === 'function') {
            cb();
          } //this is only needed for the initialization of 2 handled sliders
        } else {
          //just caching the value of the left/bottom handle's left/top property
          var handlePos = parseFloat(this.$handle[0].style[lOrT]);
          //calculate the new min-height/width for the fill bar. Use isNaN to prevent false positives for numbers <= 0
          //based on the percentage of movement of the handle being manipulated, less the opposing handle's left/top position, plus the percentage w/h of the handle itself
          dim = movement - (isNaN(handlePos) ? (this.options.initialStart - this.options.start) / ((this.options.end - this.options.start) / 100) : handlePos) + handlePct;
        }
        // assign the min-height/width to our css object
        css[`min-${hOrW}`] = `${dim}%`;
      }

      this.$element.one('finished.zf.animate', function () {
        /**
         * Fires when the handle is done moving.
         * @event Slider#moved
         */
        _this.$element.trigger('moved.zf.slider', [$hndl]);
      });

      //because we don't know exactly how the handle will be moved, check the amount of time it should take to move.
      var moveTime = this.$element.data('dragging') ? 1000 / 60 : this.options.moveTime;

      Foundation.Move(moveTime, $hndl, function () {
        // adjusting the left/top property of the handle, based on the percentage calculated above
        // if movement isNaN, that is because the slider is hidden and we cannot determine handle width,
        // fall back to next best guess.
        if (isNaN(movement)) {
          $hndl.css(lOrT, `${pctOfBar * 100}%`);
        } else {
          $hndl.css(lOrT, `${movement}%`);
        }

        if (!_this.options.doubleSided) {
          //if single-handled, a simple method to expand the fill bar
          _this.$fill.css(hOrW, `${pctOfBar * 100}%`);
        } else {
          //otherwise, use the css object we created above
          _this.$fill.css(css);
        }
      });

      /**
       * Fires when the value has not been change for a given time.
       * @event Slider#changed
       */
      clearTimeout(_this.timeout);
      _this.timeout = setTimeout(function () {
        _this.$element.trigger('changed.zf.slider', [$hndl]);
      }, _this.options.changedDelay);
    }

    /**
     * Sets the initial attribute for the slider element.
     * @function
     * @private
     * @param {Number} idx - index of the current handle/input to use.
     */
    _setInitAttr(idx) {
      var initVal = idx === 0 ? this.options.initialStart : this.options.initialEnd;
      var id = this.inputs.eq(idx).attr('id') || Foundation.GetYoDigits(6, 'slider');
      this.inputs.eq(idx).attr({
        'id': id,
        'max': this.options.end,
        'min': this.options.start,
        'step': this.options.step
      });
      this.inputs.eq(idx).val(initVal);
      this.handles.eq(idx).attr({
        'role': 'slider',
        'aria-controls': id,
        'aria-valuemax': this.options.end,
        'aria-valuemin': this.options.start,
        'aria-valuenow': initVal,
        'aria-orientation': this.options.vertical ? 'vertical' : 'horizontal',
        'tabindex': 0
      });
    }

    /**
     * Sets the input and `aria-valuenow` values for the slider element.
     * @function
     * @private
     * @param {jQuery} $handle - the currently selected handle.
     * @param {Number} val - floating point of the new value.
     */
    _setValues($handle, val) {
      var idx = this.options.doubleSided ? this.handles.index($handle) : 0;
      this.inputs.eq(idx).val(val);
      $handle.attr('aria-valuenow', val);
    }

    /**
     * Handles events on the slider element.
     * Calculates the new location of the current handle.
     * If there are two handles and the bar was clicked, it determines which handle to move.
     * @function
     * @private
     * @param {Object} e - the `event` object passed from the listener.
     * @param {jQuery} $handle - the current handle to calculate for, if selected.
     * @param {Number} val - floating point number for the new value of the slider.
     * TODO clean this up, there's a lot of repeated code between this and the _setHandlePos fn.
     */
    _handleEvent(e, $handle, val) {
      var value, hasVal;
      if (!val) {
        //click or drag events
        e.preventDefault();
        var _this = this,
            vertical = this.options.vertical,
            param = vertical ? 'height' : 'width',
            direction = vertical ? 'top' : 'left',
            eventOffset = vertical ? e.pageY : e.pageX,
            halfOfHandle = this.$handle[0].getBoundingClientRect()[param] / 2,
            barDim = this.$element[0].getBoundingClientRect()[param],
            windowScroll = vertical ? $(window).scrollTop() : $(window).scrollLeft();

        var elemOffset = this.$element.offset()[direction];

        // touch events emulated by the touch util give position relative to screen, add window.scroll to event coordinates...
        // best way to guess this is simulated is if clientY == pageY
        if (e.clientY === e.pageY) {
          eventOffset = eventOffset + windowScroll;
        }
        var eventFromBar = eventOffset - elemOffset;
        var barXY;
        if (eventFromBar < 0) {
          barXY = 0;
        } else if (eventFromBar > barDim) {
          barXY = barDim;
        } else {
          barXY = eventFromBar;
        }
        var offsetPct = percent(barXY, barDim);

        value = this._value(offsetPct);

        // turn everything around for RTL, yay math!
        if (Foundation.rtl() && !this.options.vertical) {
          value = this.options.end - value;
        }

        value = _this._adjustValue(null, value);
        //boolean flag for the setHandlePos fn, specifically for vertical sliders
        hasVal = false;

        if (!$handle) {
          //figure out which handle it is, pass it to the next function.
          var firstHndlPos = absPosition(this.$handle, direction, barXY, param),
              secndHndlPos = absPosition(this.$handle2, direction, barXY, param);
          $handle = firstHndlPos <= secndHndlPos ? this.$handle : this.$handle2;
        }
      } else {
        //change event on input
        value = this._adjustValue(null, val);
        hasVal = true;
      }

      this._setHandlePos($handle, value, hasVal);
    }

    /**
     * Adjustes value for handle in regard to step value. returns adjusted value
     * @function
     * @private
     * @param {jQuery} $handle - the selected handle.
     * @param {Number} value - value to adjust. used if $handle is falsy
     */
    _adjustValue($handle, value) {
      var val,
          step = this.options.step,
          div = parseFloat(step / 2),
          left,
          prev_val,
          next_val;
      if (!!$handle) {
        val = parseFloat($handle.attr('aria-valuenow'));
      } else {
        val = value;
      }
      left = val % step;
      prev_val = val - left;
      next_val = prev_val + step;
      if (left === 0) {
        return val;
      }
      val = val >= prev_val + div ? next_val : prev_val;
      return val;
    }

    /**
     * Adds event listeners to the slider elements.
     * @function
     * @private
     */
    _events() {
      this._eventsForHandle(this.$handle);
      if (this.handles[1]) {
        this._eventsForHandle(this.$handle2);
      }
    }

    /**
     * Adds event listeners a particular handle
     * @function
     * @private
     * @param {jQuery} $handle - the current handle to apply listeners to.
     */
    _eventsForHandle($handle) {
      var _this = this,
          curHandle,
          timer;

      this.inputs.off('change.zf.slider').on('change.zf.slider', function (e) {
        var idx = _this.inputs.index($(this));
        _this._handleEvent(e, _this.handles.eq(idx), $(this).val());
      });

      if (this.options.clickSelect) {
        this.$element.off('click.zf.slider').on('click.zf.slider', function (e) {
          if (_this.$element.data('dragging')) {
            return false;
          }

          if (!$(e.target).is('[data-slider-handle]')) {
            if (_this.options.doubleSided) {
              _this._handleEvent(e);
            } else {
              _this._handleEvent(e, _this.$handle);
            }
          }
        });
      }

      if (this.options.draggable) {
        this.handles.addTouch();

        var $body = $('body');
        $handle.off('mousedown.zf.slider').on('mousedown.zf.slider', function (e) {
          $handle.addClass('is-dragging');
          _this.$fill.addClass('is-dragging'); //
          _this.$element.data('dragging', true);

          curHandle = $(e.currentTarget);

          $body.on('mousemove.zf.slider', function (e) {
            e.preventDefault();
            _this._handleEvent(e, curHandle);
          }).on('mouseup.zf.slider', function (e) {
            _this._handleEvent(e, curHandle);

            $handle.removeClass('is-dragging');
            _this.$fill.removeClass('is-dragging');
            _this.$element.data('dragging', false);

            $body.off('mousemove.zf.slider mouseup.zf.slider');
          });
        })
        // prevent events triggered by touch
        .on('selectstart.zf.slider touchmove.zf.slider', function (e) {
          e.preventDefault();
        });
      }

      $handle.off('keydown.zf.slider').on('keydown.zf.slider', function (e) {
        var _$handle = $(this),
            idx = _this.options.doubleSided ? _this.handles.index(_$handle) : 0,
            oldValue = parseFloat(_this.inputs.eq(idx).val()),
            newValue;

        // handle keyboard event with keyboard util
        Foundation.Keyboard.handleKey(e, 'Slider', {
          decrease: function () {
            newValue = oldValue - _this.options.step;
          },
          increase: function () {
            newValue = oldValue + _this.options.step;
          },
          decrease_fast: function () {
            newValue = oldValue - _this.options.step * 10;
          },
          increase_fast: function () {
            newValue = oldValue + _this.options.step * 10;
          },
          handled: function () {
            // only set handle pos when event was handled specially
            e.preventDefault();
            _this._setHandlePos(_$handle, newValue, true);
          }
        });
        /*if (newValue) { // if pressed key has special function, update value
          e.preventDefault();
          _this._setHandlePos(_$handle, newValue);
        }*/
      });
    }

    /**
     * Destroys the slider plugin.
     */
    destroy() {
      this.handles.off('.zf.slider');
      this.inputs.off('.zf.slider');
      this.$element.off('.zf.slider');

      clearTimeout(this.timeout);

      Foundation.unregisterPlugin(this);
    }
  }

  Slider.defaults = {
    /**
     * Minimum value for the slider scale.
     * @option
     * @example 0
     */
    start: 0,
    /**
     * Maximum value for the slider scale.
     * @option
     * @example 100
     */
    end: 100,
    /**
     * Minimum value change per change event.
     * @option
     * @example 1
     */
    step: 1,
    /**
     * Value at which the handle/input *(left handle/first input)* should be set to on initialization.
     * @option
     * @example 0
     */
    initialStart: 0,
    /**
     * Value at which the right handle/second input should be set to on initialization.
     * @option
     * @example 100
     */
    initialEnd: 100,
    /**
     * Allows the input to be located outside the container and visible. Set to by the JS
     * @option
     * @example false
     */
    binding: false,
    /**
     * Allows the user to click/tap on the slider bar to select a value.
     * @option
     * @example true
     */
    clickSelect: true,
    /**
     * Set to true and use the `vertical` class to change alignment to vertical.
     * @option
     * @example false
     */
    vertical: false,
    /**
     * Allows the user to drag the slider handle(s) to select a value.
     * @option
     * @example true
     */
    draggable: true,
    /**
     * Disables the slider and prevents event listeners from being applied. Double checked by JS with `disabledClass`.
     * @option
     * @example false
     */
    disabled: false,
    /**
     * Allows the use of two handles. Double checked by the JS. Changes some logic handling.
     * @option
     * @example false
     */
    doubleSided: false,
    /**
     * Potential future feature.
     */
    // steps: 100,
    /**
     * Number of decimal places the plugin should go to for floating point precision.
     * @option
     * @example 2
     */
    decimal: 2,
    /**
     * Time delay for dragged elements.
     */
    // dragDelay: 0,
    /**
     * Time, in ms, to animate the movement of a slider handle if user clicks/taps on the bar. Needs to be manually set if updating the transition time in the Sass settings.
     * @option
     * @example 200
     */
    moveTime: 200, //update this if changing the transition time in the sass
    /**
     * Class applied to disabled sliders.
     * @option
     * @example 'disabled'
     */
    disabledClass: 'disabled',
    /**
     * Will invert the default layout for a vertical<span data-tooltip title="who would do this???"> </span>slider.
     * @option
     * @example false
     */
    invertVertical: false,
    /**
     * Milliseconds before the `changed.zf-slider` event is triggered after value change.
     * @option
     * @example 500
     */
    changedDelay: 500,
    /**
    * Basevalue for non-linear sliders
    * @option
    * @example 5
    */
    nonLinearBase: 5,
    /**
    * Basevalue for non-linear sliders, possible values are: 'linear', 'pow' & 'log'. Pow and Log use the nonLinearBase setting.
    * @option
    * @example 'linear'
    */
    positionValueFunction: 'linear'
  };

  function percent(frac, num) {
    return frac / num;
  }
  function absPosition($handle, dir, clickPos, param) {
    return Math.abs($handle.position()[dir] + $handle[param]() / 2 - clickPos);
  }
  function baseLog(base, value) {
    return Math.log(value) / Math.log(base);
  }

  // Window exports
  Foundation.plugin(Slider, 'Slider');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Sticky module.
   * @module foundation.sticky
   * @requires foundation.util.triggers
   * @requires foundation.util.mediaQuery
   */

  class Sticky {
    /**
     * Creates a new instance of a sticky thing.
     * @class
     * @param {jQuery} element - jQuery object to make sticky.
     * @param {Object} options - options object passed when creating the element programmatically.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Sticky.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Sticky');
    }

    /**
     * Initializes the sticky element by adding classes, getting/setting dimensions, breakpoints and attributes
     * @function
     * @private
     */
    _init() {
      var $parent = this.$element.parent('[data-sticky-container]'),
          id = this.$element[0].id || Foundation.GetYoDigits(6, 'sticky'),
          _this = this;

      if (!$parent.length) {
        this.wasWrapped = true;
      }
      this.$container = $parent.length ? $parent : $(this.options.container).wrapInner(this.$element);
      this.$container.addClass(this.options.containerClass);

      this.$element.addClass(this.options.stickyClass).attr({ 'data-resize': id });

      this.scrollCount = this.options.checkEvery;
      this.isStuck = false;
      $(window).one('load.zf.sticky', function () {
        //We calculate the container height to have correct values for anchor points offset calculation.
        _this.containerHeight = _this.$element.css("display") == "none" ? 0 : _this.$element[0].getBoundingClientRect().height;
        _this.$container.css('height', _this.containerHeight);
        _this.elemHeight = _this.containerHeight;
        if (_this.options.anchor !== '') {
          _this.$anchor = $('#' + _this.options.anchor);
        } else {
          _this._parsePoints();
        }

        _this._setSizes(function () {
          var scroll = window.pageYOffset;
          _this._calc(false, scroll);
          //Unstick the element will ensure that proper classes are set.
          if (!_this.isStuck) {
            _this._removeSticky(scroll >= _this.topPoint ? false : true);
          }
        });
        _this._events(id.split('-').reverse().join('-'));
      });
    }

    /**
     * If using multiple elements as anchors, calculates the top and bottom pixel values the sticky thing should stick and unstick on.
     * @function
     * @private
     */
    _parsePoints() {
      var top = this.options.topAnchor == "" ? 1 : this.options.topAnchor,
          btm = this.options.btmAnchor == "" ? document.documentElement.scrollHeight : this.options.btmAnchor,
          pts = [top, btm],
          breaks = {};
      for (var i = 0, len = pts.length; i < len && pts[i]; i++) {
        var pt;
        if (typeof pts[i] === 'number') {
          pt = pts[i];
        } else {
          var place = pts[i].split(':'),
              anchor = $(`#${place[0]}`);

          pt = anchor.offset().top;
          if (place[1] && place[1].toLowerCase() === 'bottom') {
            pt += anchor[0].getBoundingClientRect().height;
          }
        }
        breaks[i] = pt;
      }

      this.points = breaks;
      return;
    }

    /**
     * Adds event handlers for the scrolling element.
     * @private
     * @param {String} id - psuedo-random id for unique scroll event listener.
     */
    _events(id) {
      var _this = this,
          scrollListener = this.scrollListener = `scroll.zf.${id}`;
      if (this.isOn) {
        return;
      }
      if (this.canStick) {
        this.isOn = true;
        $(window).off(scrollListener).on(scrollListener, function (e) {
          if (_this.scrollCount === 0) {
            _this.scrollCount = _this.options.checkEvery;
            _this._setSizes(function () {
              _this._calc(false, window.pageYOffset);
            });
          } else {
            _this.scrollCount--;
            _this._calc(false, window.pageYOffset);
          }
        });
      }

      this.$element.off('resizeme.zf.trigger').on('resizeme.zf.trigger', function (e, el) {
        _this._setSizes(function () {
          _this._calc(false);
          if (_this.canStick) {
            if (!_this.isOn) {
              _this._events(id);
            }
          } else if (_this.isOn) {
            _this._pauseListeners(scrollListener);
          }
        });
      });
    }

    /**
     * Removes event handlers for scroll and change events on anchor.
     * @fires Sticky#pause
     * @param {String} scrollListener - unique, namespaced scroll listener attached to `window`
     */
    _pauseListeners(scrollListener) {
      this.isOn = false;
      $(window).off(scrollListener);

      /**
       * Fires when the plugin is paused due to resize event shrinking the view.
       * @event Sticky#pause
       * @private
       */
      this.$element.trigger('pause.zf.sticky');
    }

    /**
     * Called on every `scroll` event and on `_init`
     * fires functions based on booleans and cached values
     * @param {Boolean} checkSizes - true if plugin should recalculate sizes and breakpoints.
     * @param {Number} scroll - current scroll position passed from scroll event cb function. If not passed, defaults to `window.pageYOffset`.
     */
    _calc(checkSizes, scroll) {
      if (checkSizes) {
        this._setSizes();
      }

      if (!this.canStick) {
        if (this.isStuck) {
          this._removeSticky(true);
        }
        return false;
      }

      if (!scroll) {
        scroll = window.pageYOffset;
      }

      if (scroll >= this.topPoint) {
        if (scroll <= this.bottomPoint) {
          if (!this.isStuck) {
            this._setSticky();
          }
        } else {
          if (this.isStuck) {
            this._removeSticky(false);
          }
        }
      } else {
        if (this.isStuck) {
          this._removeSticky(true);
        }
      }
    }

    /**
     * Causes the $element to become stuck.
     * Adds `position: fixed;`, and helper classes.
     * @fires Sticky#stuckto
     * @function
     * @private
     */
    _setSticky() {
      var _this = this,
          stickTo = this.options.stickTo,
          mrgn = stickTo === 'top' ? 'marginTop' : 'marginBottom',
          notStuckTo = stickTo === 'top' ? 'bottom' : 'top',
          css = {};

      css[mrgn] = `${this.options[mrgn]}em`;
      css[stickTo] = 0;
      css[notStuckTo] = 'auto';
      this.isStuck = true;
      this.$element.removeClass(`is-anchored is-at-${notStuckTo}`).addClass(`is-stuck is-at-${stickTo}`).css(css)
      /**
       * Fires when the $element has become `position: fixed;`
       * Namespaced to `top` or `bottom`, e.g. `sticky.zf.stuckto:top`
       * @event Sticky#stuckto
       */
      .trigger(`sticky.zf.stuckto:${stickTo}`);
      this.$element.on("transitionend webkitTransitionEnd oTransitionEnd otransitionend MSTransitionEnd", function () {
        _this._setSizes();
      });
    }

    /**
     * Causes the $element to become unstuck.
     * Removes `position: fixed;`, and helper classes.
     * Adds other helper classes.
     * @param {Boolean} isTop - tells the function if the $element should anchor to the top or bottom of its $anchor element.
     * @fires Sticky#unstuckfrom
     * @private
     */
    _removeSticky(isTop) {
      var stickTo = this.options.stickTo,
          stickToTop = stickTo === 'top',
          css = {},
          anchorPt = (this.points ? this.points[1] - this.points[0] : this.anchorHeight) - this.elemHeight,
          mrgn = stickToTop ? 'marginTop' : 'marginBottom',
          notStuckTo = stickToTop ? 'bottom' : 'top',
          topOrBottom = isTop ? 'top' : 'bottom';

      css[mrgn] = 0;

      css['bottom'] = 'auto';
      if (isTop) {
        css['top'] = 0;
      } else {
        css['top'] = anchorPt;
      }

      this.isStuck = false;
      this.$element.removeClass(`is-stuck is-at-${stickTo}`).addClass(`is-anchored is-at-${topOrBottom}`).css(css)
      /**
       * Fires when the $element has become anchored.
       * Namespaced to `top` or `bottom`, e.g. `sticky.zf.unstuckfrom:bottom`
       * @event Sticky#unstuckfrom
       */
      .trigger(`sticky.zf.unstuckfrom:${topOrBottom}`);
    }

    /**
     * Sets the $element and $container sizes for plugin.
     * Calls `_setBreakPoints`.
     * @param {Function} cb - optional callback function to fire on completion of `_setBreakPoints`.
     * @private
     */
    _setSizes(cb) {
      this.canStick = Foundation.MediaQuery.is(this.options.stickyOn);
      if (!this.canStick) {
        if (cb && typeof cb === 'function') {
          cb();
        }
      }
      var _this = this,
          newElemWidth = this.$container[0].getBoundingClientRect().width,
          comp = window.getComputedStyle(this.$container[0]),
          pdngl = parseInt(comp['padding-left'], 10),
          pdngr = parseInt(comp['padding-right'], 10);

      if (this.$anchor && this.$anchor.length) {
        this.anchorHeight = this.$anchor[0].getBoundingClientRect().height;
      } else {
        this._parsePoints();
      }

      this.$element.css({
        'max-width': `${newElemWidth - pdngl - pdngr}px`
      });

      var newContainerHeight = this.$element[0].getBoundingClientRect().height || this.containerHeight;
      if (this.$element.css("display") == "none") {
        newContainerHeight = 0;
      }
      this.containerHeight = newContainerHeight;
      this.$container.css({
        height: newContainerHeight
      });
      this.elemHeight = newContainerHeight;

      if (!this.isStuck) {
        if (this.$element.hasClass('is-at-bottom')) {
          var anchorPt = (this.points ? this.points[1] - this.$container.offset().top : this.anchorHeight) - this.elemHeight;
          this.$element.css('top', anchorPt);
        }
      }

      this._setBreakPoints(newContainerHeight, function () {
        if (cb && typeof cb === 'function') {
          cb();
        }
      });
    }

    /**
     * Sets the upper and lower breakpoints for the element to become sticky/unsticky.
     * @param {Number} elemHeight - px value for sticky.$element height, calculated by `_setSizes`.
     * @param {Function} cb - optional callback function to be called on completion.
     * @private
     */
    _setBreakPoints(elemHeight, cb) {
      if (!this.canStick) {
        if (cb && typeof cb === 'function') {
          cb();
        } else {
          return false;
        }
      }
      var mTop = emCalc(this.options.marginTop),
          mBtm = emCalc(this.options.marginBottom),
          topPoint = this.points ? this.points[0] : this.$anchor.offset().top,
          bottomPoint = this.points ? this.points[1] : topPoint + this.anchorHeight,

      // topPoint = this.$anchor.offset().top || this.points[0],
      // bottomPoint = topPoint + this.anchorHeight || this.points[1],
      winHeight = window.innerHeight;

      if (this.options.stickTo === 'top') {
        topPoint -= mTop;
        bottomPoint -= elemHeight + mTop;
      } else if (this.options.stickTo === 'bottom') {
        topPoint -= winHeight - (elemHeight + mBtm);
        bottomPoint -= winHeight - mBtm;
      } else {
        //this would be the stickTo: both option... tricky
      }

      this.topPoint = topPoint;
      this.bottomPoint = bottomPoint;

      if (cb && typeof cb === 'function') {
        cb();
      }
    }

    /**
     * Destroys the current sticky element.
     * Resets the element to the top position first.
     * Removes event listeners, JS-added css properties and classes, and unwraps the $element if the JS added the $container.
     * @function
     */
    destroy() {
      this._removeSticky(true);

      this.$element.removeClass(`${this.options.stickyClass} is-anchored is-at-top`).css({
        height: '',
        top: '',
        bottom: '',
        'max-width': ''
      }).off('resizeme.zf.trigger');
      if (this.$anchor && this.$anchor.length) {
        this.$anchor.off('change.zf.sticky');
      }
      $(window).off(this.scrollListener);

      if (this.wasWrapped) {
        this.$element.unwrap();
      } else {
        this.$container.removeClass(this.options.containerClass).css({
          height: ''
        });
      }
      Foundation.unregisterPlugin(this);
    }
  }

  Sticky.defaults = {
    /**
     * Customizable container template. Add your own classes for styling and sizing.
     * @option
     * @example '&lt;div data-sticky-container class="small-6 columns"&gt;&lt;/div&gt;'
     */
    container: '<div data-sticky-container></div>',
    /**
     * Location in the view the element sticks to.
     * @option
     * @example 'top'
     */
    stickTo: 'top',
    /**
     * If anchored to a single element, the id of that element.
     * @option
     * @example 'exampleId'
     */
    anchor: '',
    /**
     * If using more than one element as anchor points, the id of the top anchor.
     * @option
     * @example 'exampleId:top'
     */
    topAnchor: '',
    /**
     * If using more than one element as anchor points, the id of the bottom anchor.
     * @option
     * @example 'exampleId:bottom'
     */
    btmAnchor: '',
    /**
     * Margin, in `em`'s to apply to the top of the element when it becomes sticky.
     * @option
     * @example 1
     */
    marginTop: 1,
    /**
     * Margin, in `em`'s to apply to the bottom of the element when it becomes sticky.
     * @option
     * @example 1
     */
    marginBottom: 1,
    /**
     * Breakpoint string that is the minimum screen size an element should become sticky.
     * @option
     * @example 'medium'
     */
    stickyOn: 'medium',
    /**
     * Class applied to sticky element, and removed on destruction. Foundation defaults to `sticky`.
     * @option
     * @example 'sticky'
     */
    stickyClass: 'sticky',
    /**
     * Class applied to sticky container. Foundation defaults to `sticky-container`.
     * @option
     * @example 'sticky-container'
     */
    containerClass: 'sticky-container',
    /**
     * Number of scroll events between the plugin's recalculating sticky points. Setting it to `0` will cause it to recalc every scroll event, setting it to `-1` will prevent recalc on scroll.
     * @option
     * @example 50
     */
    checkEvery: -1
  };

  /**
   * Helper function to calculate em values
   * @param Number {em} - number of em's to calculate into pixels
   */
  function emCalc(em) {
    return parseInt(window.getComputedStyle(document.body, null).fontSize, 10) * em;
  }

  // Window exports
  Foundation.plugin(Sticky, 'Sticky');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Tabs module.
   * @module foundation.tabs
   * @requires foundation.util.keyboard
   * @requires foundation.util.timerAndImageLoader if tabs contain images
   */

  class Tabs {
    /**
     * Creates a new instance of tabs.
     * @class
     * @fires Tabs#init
     * @param {jQuery} element - jQuery object to make into tabs.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Tabs.defaults, this.$element.data(), options);

      this._init();
      Foundation.registerPlugin(this, 'Tabs');
      Foundation.Keyboard.register('Tabs', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ARROW_RIGHT': 'next',
        'ARROW_UP': 'previous',
        'ARROW_DOWN': 'next',
        'ARROW_LEFT': 'previous'
        // 'TAB': 'next',
        // 'SHIFT_TAB': 'previous'
      });
    }

    /**
     * Initializes the tabs by showing and focusing (if autoFocus=true) the preset active tab.
     * @private
     */
    _init() {
      var _this = this;

      this.$element.attr({ 'role': 'tablist' });
      this.$tabTitles = this.$element.find(`.${this.options.linkClass}`);
      this.$tabContent = $(`[data-tabs-content="${this.$element[0].id}"]`);

      this.$tabTitles.each(function () {
        var $elem = $(this),
            $link = $elem.find('a'),
            isActive = $elem.hasClass(`${_this.options.linkActiveClass}`),
            hash = $link[0].hash.slice(1),
            linkId = $link[0].id ? $link[0].id : `${hash}-label`,
            $tabContent = $(`#${hash}`);

        $elem.attr({ 'role': 'presentation' });

        $link.attr({
          'role': 'tab',
          'aria-controls': hash,
          'aria-selected': isActive,
          'id': linkId
        });

        $tabContent.attr({
          'role': 'tabpanel',
          'aria-hidden': !isActive,
          'aria-labelledby': linkId
        });

        if (isActive && _this.options.autoFocus) {
          $(window).load(function () {
            $('html, body').animate({ scrollTop: $elem.offset().top }, _this.options.deepLinkSmudgeDelay, () => {
              $link.focus();
            });
          });
        }

        //use browser to open a tab, if it exists in this tabset
        if (_this.options.deepLink) {
          var anchor = window.location.hash;
          //need a hash and a relevant anchor in this tabset
          if (anchor.length) {
            var $link = $elem.find('[href="' + anchor + '"]');
            if ($link.length) {
              _this.selectTab($(anchor));

              //roll up a little to show the titles
              if (_this.options.deepLinkSmudge) {
                $(window).load(function () {
                  var offset = $elem.offset();
                  $('html, body').animate({ scrollTop: offset.top }, _this.options.deepLinkSmudgeDelay);
                });
              }

              /**
                * Fires when the zplugin has deeplinked at pageload
                * @event Tabs#deeplink
                */
              $elem.trigger('deeplink.zf.tabs', [$link, $(anchor)]);
            }
          }
        }
      });

      if (this.options.matchHeight) {
        var $images = this.$tabContent.find('img');

        if ($images.length) {
          Foundation.onImagesLoaded($images, this._setHeight.bind(this));
        } else {
          this._setHeight();
        }
      }

      this._events();
    }

    /**
     * Adds event handlers for items within the tabs.
     * @private
     */
    _events() {
      this._addKeyHandler();
      this._addClickHandler();
      this._setHeightMqHandler = null;

      if (this.options.matchHeight) {
        this._setHeightMqHandler = this._setHeight.bind(this);

        $(window).on('changed.zf.mediaquery', this._setHeightMqHandler);
      }
    }

    /**
     * Adds click handlers for items within the tabs.
     * @private
     */
    _addClickHandler() {
      var _this = this;

      this.$element.off('click.zf.tabs').on('click.zf.tabs', `.${this.options.linkClass}`, function (e) {
        e.preventDefault();
        e.stopPropagation();
        _this._handleTabChange($(this));
      });
    }

    /**
     * Adds keyboard event handlers for items within the tabs.
     * @private
     */
    _addKeyHandler() {
      var _this = this;

      this.$tabTitles.off('keydown.zf.tabs').on('keydown.zf.tabs', function (e) {
        if (e.which === 9) return;

        var $element = $(this),
            $elements = $element.parent('ul').children('li'),
            $prevElement,
            $nextElement;

        $elements.each(function (i) {
          if ($(this).is($element)) {
            if (_this.options.wrapOnKeys) {
              $prevElement = i === 0 ? $elements.last() : $elements.eq(i - 1);
              $nextElement = i === $elements.length - 1 ? $elements.first() : $elements.eq(i + 1);
            } else {
              $prevElement = $elements.eq(Math.max(0, i - 1));
              $nextElement = $elements.eq(Math.min(i + 1, $elements.length - 1));
            }
            return;
          }
        });

        // handle keyboard event with keyboard util
        Foundation.Keyboard.handleKey(e, 'Tabs', {
          open: function () {
            $element.find('[role="tab"]').focus();
            _this._handleTabChange($element);
          },
          previous: function () {
            $prevElement.find('[role="tab"]').focus();
            _this._handleTabChange($prevElement);
          },
          next: function () {
            $nextElement.find('[role="tab"]').focus();
            _this._handleTabChange($nextElement);
          },
          handled: function () {
            e.stopPropagation();
            e.preventDefault();
          }
        });
      });
    }

    /**
     * Opens the tab `$targetContent` defined by `$target`. Collapses active tab.
     * @param {jQuery} $target - Tab to open.
     * @fires Tabs#change
     * @function
     */
    _handleTabChange($target) {

      /**
       * Check for active class on target. Collapse if exists.
       */
      if ($target.hasClass(`${this.options.linkActiveClass}`)) {
        if (this.options.activeCollapse) {
          this._collapseTab($target);

          /**
           * Fires when the zplugin has successfully collapsed tabs.
           * @event Tabs#collapse
           */
          this.$element.trigger('collapse.zf.tabs', [$target]);
        }
        return;
      }

      var $oldTab = this.$element.find(`.${this.options.linkClass}.${this.options.linkActiveClass}`),
          $tabLink = $target.find('[role="tab"]'),
          hash = $tabLink[0].hash,
          $targetContent = this.$tabContent.find(hash);

      //close old tab
      this._collapseTab($oldTab);

      //open new tab
      this._openTab($target);

      //either replace or update browser history
      if (this.options.deepLink) {
        var anchor = $target.find('a').attr('href');

        if (this.options.updateHistory) {
          history.pushState({}, '', anchor);
        } else {
          history.replaceState({}, '', anchor);
        }
      }

      /**
       * Fires when the plugin has successfully changed tabs.
       * @event Tabs#change
       */
      this.$element.trigger('change.zf.tabs', [$target, $targetContent]);

      //fire to children a mutation event
      $targetContent.find("[data-mutate]").trigger("mutateme.zf.trigger");
    }

    /**
     * Opens the tab `$targetContent` defined by `$target`.
     * @param {jQuery} $target - Tab to Open.
     * @function
     */
    _openTab($target) {
      var $tabLink = $target.find('[role="tab"]'),
          hash = $tabLink[0].hash,
          $targetContent = this.$tabContent.find(hash);

      $target.addClass(`${this.options.linkActiveClass}`);

      $tabLink.attr({ 'aria-selected': 'true' });

      $targetContent.addClass(`${this.options.panelActiveClass}`).attr({ 'aria-hidden': 'false' });
    }

    /**
     * Collapses `$targetContent` defined by `$target`.
     * @param {jQuery} $target - Tab to Open.
     * @function
     */
    _collapseTab($target) {
      var $target_anchor = $target.removeClass(`${this.options.linkActiveClass}`).find('[role="tab"]').attr({ 'aria-selected': 'false' });

      $(`#${$target_anchor.attr('aria-controls')}`).removeClass(`${this.options.panelActiveClass}`).attr({ 'aria-hidden': 'true' });
    }

    /**
     * Public method for selecting a content pane to display.
     * @param {jQuery | String} elem - jQuery object or string of the id of the pane to display.
     * @function
     */
    selectTab(elem) {
      var idStr;

      if (typeof elem === 'object') {
        idStr = elem[0].id;
      } else {
        idStr = elem;
      }

      if (idStr.indexOf('#') < 0) {
        idStr = `#${idStr}`;
      }

      var $target = this.$tabTitles.find(`[href="${idStr}"]`).parent(`.${this.options.linkClass}`);

      this._handleTabChange($target);
    }
    /**
     * Sets the height of each panel to the height of the tallest panel.
     * If enabled in options, gets called on media query change.
     * If loading content via external source, can be called directly or with _reflow.
     * @function
     * @private
     */
    _setHeight() {
      var max = 0;
      this.$tabContent.find(`.${this.options.panelClass}`).css('height', '').each(function () {
        var panel = $(this),
            isActive = panel.hasClass(`${this.options.panelActiveClass}`);

        if (!isActive) {
          panel.css({ 'visibility': 'hidden', 'display': 'block' });
        }

        var temp = this.getBoundingClientRect().height;

        if (!isActive) {
          panel.css({
            'visibility': '',
            'display': ''
          });
        }

        max = temp > max ? temp : max;
      }).css('height', `${max}px`);
    }

    /**
     * Destroys an instance of an tabs.
     * @fires Tabs#destroyed
     */
    destroy() {
      this.$element.find(`.${this.options.linkClass}`).off('.zf.tabs').hide().end().find(`.${this.options.panelClass}`).hide();

      if (this.options.matchHeight) {
        if (this._setHeightMqHandler != null) {
          $(window).off('changed.zf.mediaquery', this._setHeightMqHandler);
        }
      }

      Foundation.unregisterPlugin(this);
    }
  }

  Tabs.defaults = {
    /**
     * Allows the window to scroll to content of pane specified by hash anchor
     * @option
     * @example false
     */
    deepLink: false,

    /**
     * Adjust the deep link scroll to make sure the top of the tab panel is visible
     * @option
     * @example false
     */
    deepLinkSmudge: false,

    /**
     * Animation time (ms) for the deep link adjustment
     * @option
     * @example 300
     */
    deepLinkSmudgeDelay: 300,

    /**
     * Update the browser history with the open tab
     * @option
     * @example false
     */
    updateHistory: false,

    /**
     * Allows the window to scroll to content of active pane on load if set to true.
     * Not recommended if more than one tab panel per page.
     * @option
     * @example false
     */
    autoFocus: false,

    /**
     * Allows keyboard input to 'wrap' around the tab links.
     * @option
     * @example true
     */
    wrapOnKeys: true,

    /**
     * Allows the tab content panes to match heights if set to true.
     * @option
     * @example false
     */
    matchHeight: false,

    /**
     * Allows active tabs to collapse when clicked.
     * @option
     * @example false
     */
    activeCollapse: false,

    /**
     * Class applied to `li`'s in tab link list.
     * @option
     * @example 'tabs-title'
     */
    linkClass: 'tabs-title',

    /**
     * Class applied to the active `li` in tab link list.
     * @option
     * @example 'is-active'
     */
    linkActiveClass: 'is-active',

    /**
     * Class applied to the content containers.
     * @option
     * @example 'tabs-panel'
     */
    panelClass: 'tabs-panel',

    /**
     * Class applied to the active content container.
     * @option
     * @example 'is-active'
     */
    panelActiveClass: 'is-active'
  };

  // Window exports
  Foundation.plugin(Tabs, 'Tabs');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Toggler module.
   * @module foundation.toggler
   * @requires foundation.util.motion
   * @requires foundation.util.triggers
   */

  class Toggler {
    /**
     * Creates a new instance of Toggler.
     * @class
     * @fires Toggler#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Toggler.defaults, element.data(), options);
      this.className = '';

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'Toggler');
    }

    /**
     * Initializes the Toggler plugin by parsing the toggle class from data-toggler, or animation classes from data-animate.
     * @function
     * @private
     */
    _init() {
      var input;
      // Parse animation classes if they were set
      if (this.options.animate) {
        input = this.options.animate.split(' ');

        this.animationIn = input[0];
        this.animationOut = input[1] || null;
      }
      // Otherwise, parse toggle class
      else {
          input = this.$element.data('toggler');
          // Allow for a . at the beginning of the string
          this.className = input[0] === '.' ? input.slice(1) : input;
        }

      // Add ARIA attributes to triggers
      var id = this.$element[0].id;
      $(`[data-open="${id}"], [data-close="${id}"], [data-toggle="${id}"]`).attr('aria-controls', id);
      // If the target is hidden, add aria-hidden
      this.$element.attr('aria-expanded', this.$element.is(':hidden') ? false : true);
    }

    /**
     * Initializes events for the toggle trigger.
     * @function
     * @private
     */
    _events() {
      this.$element.off('toggle.zf.trigger').on('toggle.zf.trigger', this.toggle.bind(this));
    }

    /**
     * Toggles the target class on the target element. An event is fired from the original trigger depending on if the resultant state was "on" or "off".
     * @function
     * @fires Toggler#on
     * @fires Toggler#off
     */
    toggle() {
      this[this.options.animate ? '_toggleAnimate' : '_toggleClass']();
    }

    _toggleClass() {
      this.$element.toggleClass(this.className);

      var isOn = this.$element.hasClass(this.className);
      if (isOn) {
        /**
         * Fires if the target element has the class after a toggle.
         * @event Toggler#on
         */
        this.$element.trigger('on.zf.toggler');
      } else {
        /**
         * Fires if the target element does not have the class after a toggle.
         * @event Toggler#off
         */
        this.$element.trigger('off.zf.toggler');
      }

      this._updateARIA(isOn);
      this.$element.find('[data-mutate]').trigger('mutateme.zf.trigger');
    }

    _toggleAnimate() {
      var _this = this;

      if (this.$element.is(':hidden')) {
        Foundation.Motion.animateIn(this.$element, this.animationIn, function () {
          _this._updateARIA(true);
          this.trigger('on.zf.toggler');
          this.find('[data-mutate]').trigger('mutateme.zf.trigger');
        });
      } else {
        Foundation.Motion.animateOut(this.$element, this.animationOut, function () {
          _this._updateARIA(false);
          this.trigger('off.zf.toggler');
          this.find('[data-mutate]').trigger('mutateme.zf.trigger');
        });
      }
    }

    _updateARIA(isOn) {
      this.$element.attr('aria-expanded', isOn ? true : false);
    }

    /**
     * Destroys the instance of Toggler on the element.
     * @function
     */
    destroy() {
      this.$element.off('.zf.toggler');
      Foundation.unregisterPlugin(this);
    }
  }

  Toggler.defaults = {
    /**
     * Tells the plugin if the element should animated when toggled.
     * @option
     * @example false
     */
    animate: false
  };

  // Window exports
  Foundation.plugin(Toggler, 'Toggler');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Tooltip module.
   * @module foundation.tooltip
   * @requires foundation.util.box
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.triggers
   */

  class Tooltip {
    /**
     * Creates a new instance of a Tooltip.
     * @class
     * @fires Tooltip#init
     * @param {jQuery} element - jQuery object to attach a tooltip to.
     * @param {Object} options - object to extend the default configuration.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Tooltip.defaults, this.$element.data(), options);

      this.isActive = false;
      this.isClick = false;
      this._init();

      Foundation.registerPlugin(this, 'Tooltip');
    }

    /**
     * Initializes the tooltip by setting the creating the tip element, adding it's text, setting private variables and setting attributes on the anchor.
     * @private
     */
    _init() {
      var elemId = this.$element.attr('aria-describedby') || Foundation.GetYoDigits(6, 'tooltip');

      this.options.positionClass = this.options.positionClass || this._getPositionClass(this.$element);
      this.options.tipText = this.options.tipText || this.$element.attr('title');
      this.template = this.options.template ? $(this.options.template) : this._buildTemplate(elemId);

      if (this.options.allowHtml) {
        this.template.appendTo(document.body).html(this.options.tipText).hide();
      } else {
        this.template.appendTo(document.body).text(this.options.tipText).hide();
      }

      this.$element.attr({
        'title': '',
        'aria-describedby': elemId,
        'data-yeti-box': elemId,
        'data-toggle': elemId,
        'data-resize': elemId
      }).addClass(this.options.triggerClass);

      //helper variables to track movement on collisions
      this.usedPositions = [];
      this.counter = 4;
      this.classChanged = false;

      this._events();
    }

    /**
     * Grabs the current positioning class, if present, and returns the value or an empty string.
     * @private
     */
    _getPositionClass(element) {
      if (!element) {
        return '';
      }
      // var position = element.attr('class').match(/top|left|right/g);
      var position = element[0].className.match(/\b(top|left|right)\b/g);
      position = position ? position[0] : '';
      return position;
    }
    /**
     * builds the tooltip element, adds attributes, and returns the template.
     * @private
     */
    _buildTemplate(id) {
      var templateClasses = `${this.options.tooltipClass} ${this.options.positionClass} ${this.options.templateClasses}`.trim();
      var $template = $('<div></div>').addClass(templateClasses).attr({
        'role': 'tooltip',
        'aria-hidden': true,
        'data-is-active': false,
        'data-is-focus': false,
        'id': id
      });
      return $template;
    }

    /**
     * Function that gets called if a collision event is detected.
     * @param {String} position - positioning class to try
     * @private
     */
    _reposition(position) {
      this.usedPositions.push(position ? position : 'bottom');

      //default, try switching to opposite side
      if (!position && this.usedPositions.indexOf('top') < 0) {
        this.template.addClass('top');
      } else if (position === 'top' && this.usedPositions.indexOf('bottom') < 0) {
        this.template.removeClass(position);
      } else if (position === 'left' && this.usedPositions.indexOf('right') < 0) {
        this.template.removeClass(position).addClass('right');
      } else if (position === 'right' && this.usedPositions.indexOf('left') < 0) {
        this.template.removeClass(position).addClass('left');
      }

      //if default change didn't work, try bottom or left first
      else if (!position && this.usedPositions.indexOf('top') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.template.addClass('left');
        } else if (position === 'top' && this.usedPositions.indexOf('bottom') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.template.removeClass(position).addClass('left');
        } else if (position === 'left' && this.usedPositions.indexOf('right') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.template.removeClass(position);
        } else if (position === 'right' && this.usedPositions.indexOf('left') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.template.removeClass(position);
        }
        //if nothing cleared, set to bottom
        else {
            this.template.removeClass(position);
          }
      this.classChanged = true;
      this.counter--;
    }

    /**
     * sets the position class of an element and recursively calls itself until there are no more possible positions to attempt, or the tooltip element is no longer colliding.
     * if the tooltip is larger than the screen width, default to full width - any user selected margin
     * @private
     */
    _setPosition() {
      var position = this._getPositionClass(this.template),
          $tipDims = Foundation.Box.GetDimensions(this.template),
          $anchorDims = Foundation.Box.GetDimensions(this.$element),
          direction = position === 'left' ? 'left' : position === 'right' ? 'left' : 'top',
          param = direction === 'top' ? 'height' : 'width',
          offset = param === 'height' ? this.options.vOffset : this.options.hOffset,
          _this = this;

      if ($tipDims.width >= $tipDims.windowDims.width || !this.counter && !Foundation.Box.ImNotTouchingYou(this.template)) {
        this.template.offset(Foundation.Box.GetOffsets(this.template, this.$element, 'center bottom', this.options.vOffset, this.options.hOffset, true)).css({
          // this.$element.offset(Foundation.GetOffsets(this.template, this.$element, 'center bottom', this.options.vOffset, this.options.hOffset, true)).css({
          'width': $anchorDims.windowDims.width - this.options.hOffset * 2,
          'height': 'auto'
        });
        return false;
      }

      this.template.offset(Foundation.Box.GetOffsets(this.template, this.$element, 'center ' + (position || 'bottom'), this.options.vOffset, this.options.hOffset));

      while (!Foundation.Box.ImNotTouchingYou(this.template) && this.counter) {
        this._reposition(position);
        this._setPosition();
      }
    }

    /**
     * reveals the tooltip, and fires an event to close any other open tooltips on the page
     * @fires Tooltip#closeme
     * @fires Tooltip#show
     * @function
     */
    show() {
      if (this.options.showOn !== 'all' && !Foundation.MediaQuery.is(this.options.showOn)) {
        // console.error('The screen is too small to display this tooltip');
        return false;
      }

      var _this = this;
      this.template.css('visibility', 'hidden').show();
      this._setPosition();

      /**
       * Fires to close all other open tooltips on the page
       * @event Closeme#tooltip
       */
      this.$element.trigger('closeme.zf.tooltip', this.template.attr('id'));

      this.template.attr({
        'data-is-active': true,
        'aria-hidden': false
      });
      _this.isActive = true;
      // console.log(this.template);
      this.template.stop().hide().css('visibility', '').fadeIn(this.options.fadeInDuration, function () {
        //maybe do stuff?
      });
      /**
       * Fires when the tooltip is shown
       * @event Tooltip#show
       */
      this.$element.trigger('show.zf.tooltip');
    }

    /**
     * Hides the current tooltip, and resets the positioning class if it was changed due to collision
     * @fires Tooltip#hide
     * @function
     */
    hide() {
      // console.log('hiding', this.$element.data('yeti-box'));
      var _this = this;
      this.template.stop().attr({
        'aria-hidden': true,
        'data-is-active': false
      }).fadeOut(this.options.fadeOutDuration, function () {
        _this.isActive = false;
        _this.isClick = false;
        if (_this.classChanged) {
          _this.template.removeClass(_this._getPositionClass(_this.template)).addClass(_this.options.positionClass);

          _this.usedPositions = [];
          _this.counter = 4;
          _this.classChanged = false;
        }
      });
      /**
       * fires when the tooltip is hidden
       * @event Tooltip#hide
       */
      this.$element.trigger('hide.zf.tooltip');
    }

    /**
     * adds event listeners for the tooltip and its anchor
     * TODO combine some of the listeners like focus and mouseenter, etc.
     * @private
     */
    _events() {
      var _this = this;
      var $template = this.template;
      var isFocus = false;

      if (!this.options.disableHover) {

        this.$element.on('mouseenter.zf.tooltip', function (e) {
          if (!_this.isActive) {
            _this.timeout = setTimeout(function () {
              _this.show();
            }, _this.options.hoverDelay);
          }
        }).on('mouseleave.zf.tooltip', function (e) {
          clearTimeout(_this.timeout);
          if (!isFocus || _this.isClick && !_this.options.clickOpen) {
            _this.hide();
          }
        });
      }

      if (this.options.clickOpen) {
        this.$element.on('mousedown.zf.tooltip', function (e) {
          e.stopImmediatePropagation();
          if (_this.isClick) {
            //_this.hide();
            // _this.isClick = false;
          } else {
            _this.isClick = true;
            if ((_this.options.disableHover || !_this.$element.attr('tabindex')) && !_this.isActive) {
              _this.show();
            }
          }
        });
      } else {
        this.$element.on('mousedown.zf.tooltip', function (e) {
          e.stopImmediatePropagation();
          _this.isClick = true;
        });
      }

      if (!this.options.disableForTouch) {
        this.$element.on('tap.zf.tooltip touchend.zf.tooltip', function (e) {
          _this.isActive ? _this.hide() : _this.show();
        });
      }

      this.$element.on({
        // 'toggle.zf.trigger': this.toggle.bind(this),
        // 'close.zf.trigger': this.hide.bind(this)
        'close.zf.trigger': this.hide.bind(this)
      });

      this.$element.on('focus.zf.tooltip', function (e) {
        isFocus = true;
        if (_this.isClick) {
          // If we're not showing open on clicks, we need to pretend a click-launched focus isn't
          // a real focus, otherwise on hover and come back we get bad behavior
          if (!_this.options.clickOpen) {
            isFocus = false;
          }
          return false;
        } else {
          _this.show();
        }
      }).on('focusout.zf.tooltip', function (e) {
        isFocus = false;
        _this.isClick = false;
        _this.hide();
      }).on('resizeme.zf.trigger', function () {
        if (_this.isActive) {
          _this._setPosition();
        }
      });
    }

    /**
     * adds a toggle method, in addition to the static show() & hide() functions
     * @function
     */
    toggle() {
      if (this.isActive) {
        this.hide();
      } else {
        this.show();
      }
    }

    /**
     * Destroys an instance of tooltip, removes template element from the view.
     * @function
     */
    destroy() {
      this.$element.attr('title', this.template.text()).off('.zf.trigger .zf.tooltip').removeClass('has-tip top right left').removeAttr('aria-describedby aria-haspopup data-disable-hover data-resize data-toggle data-tooltip data-yeti-box');

      this.template.remove();

      Foundation.unregisterPlugin(this);
    }
  }

  Tooltip.defaults = {
    disableForTouch: false,
    /**
     * Time, in ms, before a tooltip should open on hover.
     * @option
     * @example 200
     */
    hoverDelay: 200,
    /**
     * Time, in ms, a tooltip should take to fade into view.
     * @option
     * @example 150
     */
    fadeInDuration: 150,
    /**
     * Time, in ms, a tooltip should take to fade out of view.
     * @option
     * @example 150
     */
    fadeOutDuration: 150,
    /**
     * Disables hover events from opening the tooltip if set to true
     * @option
     * @example false
     */
    disableHover: false,
    /**
     * Optional addtional classes to apply to the tooltip template on init.
     * @option
     * @example 'my-cool-tip-class'
     */
    templateClasses: '',
    /**
     * Non-optional class added to tooltip templates. Foundation default is 'tooltip'.
     * @option
     * @example 'tooltip'
     */
    tooltipClass: 'tooltip',
    /**
     * Class applied to the tooltip anchor element.
     * @option
     * @example 'has-tip'
     */
    triggerClass: 'has-tip',
    /**
     * Minimum breakpoint size at which to open the tooltip.
     * @option
     * @example 'small'
     */
    showOn: 'small',
    /**
     * Custom template to be used to generate markup for tooltip.
     * @option
     * @example '&lt;div class="tooltip"&gt;&lt;/div&gt;'
     */
    template: '',
    /**
     * Text displayed in the tooltip template on open.
     * @option
     * @example 'Some cool space fact here.'
     */
    tipText: '',
    touchCloseText: 'Tap to close.',
    /**
     * Allows the tooltip to remain open if triggered with a click or touch event.
     * @option
     * @example true
     */
    clickOpen: true,
    /**
     * Additional positioning classes, set by the JS
     * @option
     * @example 'top'
     */
    positionClass: '',
    /**
     * Distance, in pixels, the template should push away from the anchor on the Y axis.
     * @option
     * @example 10
     */
    vOffset: 10,
    /**
     * Distance, in pixels, the template should push away from the anchor on the X axis, if aligned to a side.
     * @option
     * @example 12
     */
    hOffset: 12,
    /**
    * Allow HTML in tooltip. Warning: If you are loading user-generated content into tooltips,
    * allowing HTML may open yourself up to XSS attacks.
    * @option
    * @example false
    */
    allowHtml: false
  };

  /**
   * TODO utilize resize event trigger
   */

  // Window exports
  Foundation.plugin(Tooltip, 'Tooltip');
}(jQuery);
;'use strict';

// Polyfill for requestAnimationFrame

(function () {
  if (!Date.now) Date.now = function () {
    return new Date().getTime();
  };

  var vendors = ['webkit', 'moz'];
  for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
    var vp = vendors[i];
    window.requestAnimationFrame = window[vp + 'RequestAnimationFrame'];
    window.cancelAnimationFrame = window[vp + 'CancelAnimationFrame'] || window[vp + 'CancelRequestAnimationFrame'];
  }
  if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
    var lastTime = 0;
    window.requestAnimationFrame = function (callback) {
      var now = Date.now();
      var nextTime = Math.max(lastTime + 16, now);
      return setTimeout(function () {
        callback(lastTime = nextTime);
      }, nextTime - now);
    };
    window.cancelAnimationFrame = clearTimeout;
  }
})();

var initClasses = ['mui-enter', 'mui-leave'];
var activeClasses = ['mui-enter-active', 'mui-leave-active'];

// Find the right "transitionend" event for this browser
var endEvent = function () {
  var transitions = {
    'transition': 'transitionend',
    'WebkitTransition': 'webkitTransitionEnd',
    'MozTransition': 'transitionend',
    'OTransition': 'otransitionend'
  };
  var elem = window.document.createElement('div');

  for (var t in transitions) {
    if (typeof elem.style[t] !== 'undefined') {
      return transitions[t];
    }
  }

  return null;
}();

function animate(isIn, element, animation, cb) {
  element = $(element).eq(0);

  if (!element.length) return;

  if (endEvent === null) {
    isIn ? element.show() : element.hide();
    cb();
    return;
  }

  var initClass = isIn ? initClasses[0] : initClasses[1];
  var activeClass = isIn ? activeClasses[0] : activeClasses[1];

  // Set up the animation
  reset();
  element.addClass(animation);
  element.css('transition', 'none');
  requestAnimationFrame(function () {
    element.addClass(initClass);
    if (isIn) element.show();
  });

  // Start the animation
  requestAnimationFrame(function () {
    element[0].offsetWidth;
    element.css('transition', '');
    element.addClass(activeClass);
  });

  // Clean up the animation when it finishes
  element.one('transitionend', finish);

  // Hides the element (for out animations), resets the element, and runs a callback
  function finish() {
    if (!isIn) element.hide();
    reset();
    if (cb) cb.apply(element);
  }

  // Resets transitions and removes motion-specific classes
  function reset() {
    element[0].style.transitionDuration = 0;
    element.removeClass(initClass + ' ' + activeClass + ' ' + animation);
  }
}

var MotionUI = {
  animateIn: function (element, animation, cb) {
    animate(true, element, animation, cb);
  },

  animateOut: function (element, animation, cb) {
    animate(false, element, animation, cb);
  }
};
;$(function () {
  $(window).scroll(function () {

    $('.hideme').each(function (i) {

      var bottom_of_object = $(this).position().top + $(this).outerHeight();
      var bottom_of_window = $(window).scrollTop() + $(window).height();

      /* Adjust the "200" to either have a delay or that the content starts fading a bit before you reach it  */
      bottom_of_window = bottom_of_window + 500;

      if (bottom_of_window > bottom_of_object) {

        $(this).animate({ 'opacity': '1' }, 500);
      }
    });
  });
});

$(window).scroll(function () {

  /* animazione top menu */
  if ($(this).scrollTop() > 50) {
    $("#backtotop").css("opacity", " 1");
  } else {
    $("#backtotop").css("opacity", "0");
  }
});

/*Azione GoTop*/
function goto_top() {
  $('html, body').animate({
    scrollTop: 0
  }, 1500);
}

/* BACK TO TOP */
$("#backtotop a").click(function () {
  goto_top();
});

/*Roll-hover immagini winner*/

$(document).ready(function () {
  $('.single-event').hover(function () {

    $(this).find('.caption').fadeIn(350);
  }, function () {
    $(this).find('.caption').fadeOut(200);
  });
});

$(document).ready(function () {
  $('.single-event6').hover(function () {

    $(this).find('.caption').fadeIn(350);
  }, function () {
    $(this).find('.caption').fadeOut(200);
  });
});

$(window).scroll(function () {
  if ($(this).scrollTop() > 50) {
    $(".is-stuck").addClass("smaller");
    $(".is-stuck").removeClass("bigger");
    $(".orbit-image").addClass("grey-on");
  } else {
    $(".is-stuck").removeClass("smaller");
    $(".top-bar").addClass("bigger");
    $("img.orbit-image").removeClass("grey-on");
  }
});
;

function initMap() {
  //var marker;

  // Create a new StyledMapType object, passing it an array of styles,
  // and the name to be displayed on the map type control.
  var styledMapType = new google.maps.StyledMapType(

  /*
      {elementType: 'geometry', stylers: [{color: '#000000'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#523735'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#f5f1e6'}]},
      */
  [{
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{
      "color": "#804040"
    }]
  }, {
    "featureType": "administrative",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000040"
    }]
  }, {
    "featureType": "administrative",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#000040"
    }]
  }, {
    "featureType": "administrative.country",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#800000"
    }, {
      "visibility": "on"
    }]
  }, {
    "featureType": "administrative.country",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#800000"
    }]
  }, {
    "featureType": "administrative.country",
    "elementType": "labels.text",
    "stylers": [{
      "color": "#808000"
    }, {
      "visibility": "simplified"
    }]
  }, {
    "featureType": "administrative.land_parcel",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "on"
    }]
  }, {
    "featureType": "administrative.land_parcel",
    "elementType": "geometry.stroke",
    "stylers": [{
      "visibility": "simplified"
    }]
  }, {
    "featureType": "administrative.locality",
    "stylers": [{
      "visibility": "off"
    }]
  }, {
    "featureType": "administrative.locality",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "on"
    }]
  }, {
    "featureType": "administrative.neighborhood",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "simplified"
    }]
  }, {
    "featureType": "landscape.man_made",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#818285"
    }, {
      "saturation": 20
    }, {
      "lightness": 45
    }]
  }, {
    "featureType": "landscape.man_made",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#000000"
    }, {
      "visibility": "on"
    }]
  }, {
    "featureType": "landscape.man_made",
    "elementType": "labels.text.fill",
    "stylers": [{
      "saturation": 50
    }, {
      "lightness": -40
    }]
  }, {
    "featureType": "landscape.natural",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#408080"
    }]
  }, {
    "featureType": "landscape.natural.landcover",
    "elementType": "geometry.fill",
    "stylers": [{
      "saturation": -20
    }, {
      "lightness": 100
    }]
  }, {
    "featureType": "landscape.natural.terrain",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "simplified"
    }]
  }, {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [{
      "saturation": 35
    }, {
      "lightness": 35
    }]
  }, {
    "featureType": "poi.place_of_worship",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000000"
    }]
  }, {
    "featureType": "road.arterial",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#cfb63a"
    }, {
      "saturation": 100
    }, {
      "lightness": 25
    }, {
      "weight": 2.5
    }]
  }, {
    "featureType": "road.arterial",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#cfb63a"
    }]
  }, {
    "featureType": "road.highway",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#3c94c4"
    }, {
      "lightness": 45
    }]
  }, {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#ff8000"
    }]
  }, {
    "featureType": "road.local",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#cfbb52"
    }, {
      "lightness": 5
    }, {
      "weight": 4
    }]
  }, {
    "featureType": "transit.station.bus",
    "elementType": "geometry",
    "stylers": [{
      "color": "#80ff00"
    }]
  }, {
    "featureType": "transit.station.bus",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000000"
    }]
  }, {
    "featureType": "transit.station.rail",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000000"
    }]
  }], { name: 'Styled Map' });

  var map = new google.maps.Map(document.getElementById('map'), {
    zoom: 19,
    center: { lat: 45.48108850000001, lng: 9.208886399999983 }
  });

  map.mapTypes.set('styled_map', styledMapType);
  map.setMapTypeId('styled_map');

  var image = 'http://www.artena.eu/test/wp-content/themes/FoundationPress/assets/images/marker.png';
  var beachMarker = new google.maps.Marker({
    position: { lat: 45.48108850000001, lng: 9.208886399999983 },
    map: map,
    icon: image
  });
  /* marker = new google.maps.Marker({
  	 map: map,
  	 draggable: false,
  	 animation: google.maps.Animation.DROP,
  	 title: 'Argentaria',
  	 position: {lat: 45.48108850000001, lng: 9.208886399999983}
  
  
   });
   marker.addListener('click', toggleBounce);*/
}

/*function toggleBounce() {
if (marker.getAnimation() !== null) {
marker.setAnimation(null);
} else {
marker.setAnimation(google.maps.Animation.BOUNCE);
}
}*/
;jQuery(document).foundation();
;// Joyride demo
$('#start-jr').on('click', function () {
  $(document).foundation('joyride', 'start');
});
;
;$(document).ready(function () {
    var videos = $('iframe[src*="vimeo.com"], iframe[src*="youtube.com"]');

    videos.each(function () {
        var el = $(this);
        el.wrap('<div class="responsive-embed widescreen"/>');
    });
});
;
$(window).bind(' load resize orientationChange ', function () {
   var footer = $("#footer-container");
   var pos = footer.position();
   var height = $(window).height();
   height = height - pos.top;
   height = height - footer.height() - 1;

   function stickyFooter() {
      footer.css({
         'margin-top': height + 'px'
      });
   }

   if (height > 0) {
      stickyFooter();
   }
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvdW5kYXRpb24uY29yZS5qcyIsImZvdW5kYXRpb24udXRpbC5ib3guanMiLCJmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmQuanMiLCJmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeS5qcyIsImZvdW5kYXRpb24udXRpbC5tb3Rpb24uanMiLCJmb3VuZGF0aW9uLnV0aWwubmVzdC5qcyIsImZvdW5kYXRpb24udXRpbC50aW1lckFuZEltYWdlTG9hZGVyLmpzIiwiZm91bmRhdGlvbi51dGlsLnRvdWNoLmpzIiwiZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzLmpzIiwiZm91bmRhdGlvbi5hYmlkZS5qcyIsImZvdW5kYXRpb24uYWNjb3JkaW9uLmpzIiwiZm91bmRhdGlvbi5hY2NvcmRpb25NZW51LmpzIiwiZm91bmRhdGlvbi5kcmlsbGRvd24uanMiLCJmb3VuZGF0aW9uLmRyb3Bkb3duLmpzIiwiZm91bmRhdGlvbi5kcm9wZG93bk1lbnUuanMiLCJmb3VuZGF0aW9uLmVxdWFsaXplci5qcyIsImZvdW5kYXRpb24uaW50ZXJjaGFuZ2UuanMiLCJmb3VuZGF0aW9uLm1hZ2VsbGFuLmpzIiwiZm91bmRhdGlvbi5vZmZjYW52YXMuanMiLCJmb3VuZGF0aW9uLm9yYml0LmpzIiwiZm91bmRhdGlvbi5yZXNwb25zaXZlTWVudS5qcyIsImZvdW5kYXRpb24ucmVzcG9uc2l2ZVRvZ2dsZS5qcyIsImZvdW5kYXRpb24ucmV2ZWFsLmpzIiwiZm91bmRhdGlvbi5zbGlkZXIuanMiLCJmb3VuZGF0aW9uLnN0aWNreS5qcyIsImZvdW5kYXRpb24udGFicy5qcyIsImZvdW5kYXRpb24udG9nZ2xlci5qcyIsImZvdW5kYXRpb24udG9vbHRpcC5qcyIsIm1vdGlvbi11aS5qcyIsImFydGVuYS5qcyIsImdvb2dsZS1tYXAuanMiLCJpbml0LWZvdW5kYXRpb24uanMiLCJqb3lyaWRlLWRlbW8uanMiLCJvZmZDYW52YXMuanMiLCJyZXNwb25zaXZlLXZpZGVvLmpzIiwic3RpY2t5Zm9vdGVyLmpzIl0sIm5hbWVzIjpbIiQiLCJGT1VOREFUSU9OX1ZFUlNJT04iLCJGb3VuZGF0aW9uIiwidmVyc2lvbiIsIl9wbHVnaW5zIiwiX3V1aWRzIiwicnRsIiwiYXR0ciIsInBsdWdpbiIsIm5hbWUiLCJjbGFzc05hbWUiLCJmdW5jdGlvbk5hbWUiLCJhdHRyTmFtZSIsImh5cGhlbmF0ZSIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luTmFtZSIsImNvbnN0cnVjdG9yIiwidG9Mb3dlckNhc2UiLCJ1dWlkIiwiR2V0WW9EaWdpdHMiLCIkZWxlbWVudCIsImRhdGEiLCJ0cmlnZ2VyIiwicHVzaCIsInVucmVnaXN0ZXJQbHVnaW4iLCJzcGxpY2UiLCJpbmRleE9mIiwicmVtb3ZlQXR0ciIsInJlbW92ZURhdGEiLCJwcm9wIiwicmVJbml0IiwicGx1Z2lucyIsImlzSlEiLCJlYWNoIiwiX2luaXQiLCJ0eXBlIiwiX3RoaXMiLCJmbnMiLCJwbGdzIiwiZm9yRWFjaCIsInAiLCJmb3VuZGF0aW9uIiwiT2JqZWN0Iiwia2V5cyIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsImxlbmd0aCIsIm5hbWVzcGFjZSIsIk1hdGgiLCJyb3VuZCIsInBvdyIsInJhbmRvbSIsInRvU3RyaW5nIiwic2xpY2UiLCJyZWZsb3ciLCJlbGVtIiwiaSIsIiRlbGVtIiwiZmluZCIsImFkZEJhY2siLCIkZWwiLCJvcHRzIiwid2FybiIsInRoaW5nIiwic3BsaXQiLCJlIiwib3B0IiwibWFwIiwiZWwiLCJ0cmltIiwicGFyc2VWYWx1ZSIsImVyIiwiZ2V0Rm5OYW1lIiwidHJhbnNpdGlvbmVuZCIsInRyYW5zaXRpb25zIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiZW5kIiwidCIsInN0eWxlIiwic2V0VGltZW91dCIsInRyaWdnZXJIYW5kbGVyIiwidXRpbCIsInRocm90dGxlIiwiZnVuYyIsImRlbGF5IiwidGltZXIiLCJjb250ZXh0IiwiYXJncyIsImFyZ3VtZW50cyIsImFwcGx5IiwibWV0aG9kIiwiJG1ldGEiLCIkbm9KUyIsImFwcGVuZFRvIiwiaGVhZCIsInJlbW92ZUNsYXNzIiwiTWVkaWFRdWVyeSIsIkFycmF5IiwicHJvdG90eXBlIiwiY2FsbCIsInBsdWdDbGFzcyIsInVuZGVmaW5lZCIsIlJlZmVyZW5jZUVycm9yIiwiVHlwZUVycm9yIiwid2luZG93IiwiZm4iLCJEYXRlIiwibm93IiwiZ2V0VGltZSIsInZlbmRvcnMiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJ2cCIsImNhbmNlbEFuaW1hdGlvbkZyYW1lIiwidGVzdCIsIm5hdmlnYXRvciIsInVzZXJBZ2VudCIsImxhc3RUaW1lIiwiY2FsbGJhY2siLCJuZXh0VGltZSIsIm1heCIsImNsZWFyVGltZW91dCIsInBlcmZvcm1hbmNlIiwic3RhcnQiLCJGdW5jdGlvbiIsImJpbmQiLCJvVGhpcyIsImFBcmdzIiwiZlRvQmluZCIsImZOT1AiLCJmQm91bmQiLCJjb25jYXQiLCJmdW5jTmFtZVJlZ2V4IiwicmVzdWx0cyIsImV4ZWMiLCJzdHIiLCJpc05hTiIsInBhcnNlRmxvYXQiLCJyZXBsYWNlIiwialF1ZXJ5IiwiQm94IiwiSW1Ob3RUb3VjaGluZ1lvdSIsIkdldERpbWVuc2lvbnMiLCJHZXRPZmZzZXRzIiwiZWxlbWVudCIsInBhcmVudCIsImxyT25seSIsInRiT25seSIsImVsZURpbXMiLCJ0b3AiLCJib3R0b20iLCJsZWZ0IiwicmlnaHQiLCJwYXJEaW1zIiwib2Zmc2V0IiwiaGVpZ2h0Iiwid2lkdGgiLCJ3aW5kb3dEaW1zIiwiYWxsRGlycyIsIkVycm9yIiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsInBhclJlY3QiLCJwYXJlbnROb2RlIiwid2luUmVjdCIsImJvZHkiLCJ3aW5ZIiwicGFnZVlPZmZzZXQiLCJ3aW5YIiwicGFnZVhPZmZzZXQiLCJwYXJlbnREaW1zIiwiYW5jaG9yIiwicG9zaXRpb24iLCJ2T2Zmc2V0IiwiaE9mZnNldCIsImlzT3ZlcmZsb3ciLCIkZWxlRGltcyIsIiRhbmNob3JEaW1zIiwia2V5Q29kZXMiLCJjb21tYW5kcyIsIktleWJvYXJkIiwiZ2V0S2V5Q29kZXMiLCJwYXJzZUtleSIsImV2ZW50Iiwia2V5Iiwid2hpY2giLCJrZXlDb2RlIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidG9VcHBlckNhc2UiLCJzaGlmdEtleSIsImN0cmxLZXkiLCJhbHRLZXkiLCJoYW5kbGVLZXkiLCJjb21wb25lbnQiLCJmdW5jdGlvbnMiLCJjb21tYW5kTGlzdCIsImNtZHMiLCJjb21tYW5kIiwibHRyIiwiZXh0ZW5kIiwicmV0dXJuVmFsdWUiLCJoYW5kbGVkIiwidW5oYW5kbGVkIiwiZmluZEZvY3VzYWJsZSIsImZpbHRlciIsImlzIiwicmVnaXN0ZXIiLCJjb21wb25lbnROYW1lIiwidHJhcEZvY3VzIiwiJGZvY3VzYWJsZSIsIiRmaXJzdEZvY3VzYWJsZSIsImVxIiwiJGxhc3RGb2N1c2FibGUiLCJvbiIsInRhcmdldCIsInByZXZlbnREZWZhdWx0IiwiZm9jdXMiLCJyZWxlYXNlRm9jdXMiLCJvZmYiLCJrY3MiLCJrIiwia2MiLCJkZWZhdWx0UXVlcmllcyIsImxhbmRzY2FwZSIsInBvcnRyYWl0IiwicmV0aW5hIiwicXVlcmllcyIsImN1cnJlbnQiLCJzZWxmIiwiZXh0cmFjdGVkU3R5bGVzIiwiY3NzIiwibmFtZWRRdWVyaWVzIiwicGFyc2VTdHlsZVRvT2JqZWN0IiwiaGFzT3duUHJvcGVydHkiLCJ2YWx1ZSIsIl9nZXRDdXJyZW50U2l6ZSIsIl93YXRjaGVyIiwiYXRMZWFzdCIsInNpemUiLCJxdWVyeSIsImdldCIsIm1hdGNoTWVkaWEiLCJtYXRjaGVzIiwibWF0Y2hlZCIsIm5ld1NpemUiLCJjdXJyZW50U2l6ZSIsInN0eWxlTWVkaWEiLCJtZWRpYSIsInNjcmlwdCIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwiaW5mbyIsImlkIiwiaW5zZXJ0QmVmb3JlIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsImN1cnJlbnRTdHlsZSIsIm1hdGNoTWVkaXVtIiwidGV4dCIsInN0eWxlU2hlZXQiLCJjc3NUZXh0IiwidGV4dENvbnRlbnQiLCJzdHlsZU9iamVjdCIsInJlZHVjZSIsInJldCIsInBhcmFtIiwicGFydHMiLCJ2YWwiLCJkZWNvZGVVUklDb21wb25lbnQiLCJpc0FycmF5IiwiaW5pdENsYXNzZXMiLCJhY3RpdmVDbGFzc2VzIiwiTW90aW9uIiwiYW5pbWF0ZUluIiwiYW5pbWF0aW9uIiwiY2IiLCJhbmltYXRlIiwiYW5pbWF0ZU91dCIsIk1vdmUiLCJkdXJhdGlvbiIsImFuaW0iLCJwcm9nIiwibW92ZSIsInRzIiwiaXNJbiIsImluaXRDbGFzcyIsImFjdGl2ZUNsYXNzIiwicmVzZXQiLCJhZGRDbGFzcyIsInNob3ciLCJvZmZzZXRXaWR0aCIsIm9uZSIsImZpbmlzaCIsImhpZGUiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJOZXN0IiwiRmVhdGhlciIsIm1lbnUiLCJpdGVtcyIsInN1Yk1lbnVDbGFzcyIsInN1Ykl0ZW1DbGFzcyIsImhhc1N1YkNsYXNzIiwiJGl0ZW0iLCIkc3ViIiwiY2hpbGRyZW4iLCJCdXJuIiwiVGltZXIiLCJvcHRpb25zIiwibmFtZVNwYWNlIiwicmVtYWluIiwiaXNQYXVzZWQiLCJyZXN0YXJ0IiwiaW5maW5pdGUiLCJwYXVzZSIsIm9uSW1hZ2VzTG9hZGVkIiwiaW1hZ2VzIiwidW5sb2FkZWQiLCJjb21wbGV0ZSIsInJlYWR5U3RhdGUiLCJzaW5nbGVJbWFnZUxvYWRlZCIsInNyYyIsInNwb3RTd2lwZSIsImVuYWJsZWQiLCJkb2N1bWVudEVsZW1lbnQiLCJtb3ZlVGhyZXNob2xkIiwidGltZVRocmVzaG9sZCIsInN0YXJ0UG9zWCIsInN0YXJ0UG9zWSIsInN0YXJ0VGltZSIsImVsYXBzZWRUaW1lIiwiaXNNb3ZpbmciLCJvblRvdWNoRW5kIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm9uVG91Y2hNb3ZlIiwieCIsInRvdWNoZXMiLCJwYWdlWCIsInkiLCJwYWdlWSIsImR4IiwiZHkiLCJkaXIiLCJhYnMiLCJvblRvdWNoU3RhcnQiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5pdCIsInRlYXJkb3duIiwic3BlY2lhbCIsInN3aXBlIiwic2V0dXAiLCJub29wIiwiYWRkVG91Y2giLCJoYW5kbGVUb3VjaCIsImNoYW5nZWRUb3VjaGVzIiwiZmlyc3QiLCJldmVudFR5cGVzIiwidG91Y2hzdGFydCIsInRvdWNobW92ZSIsInRvdWNoZW5kIiwic2ltdWxhdGVkRXZlbnQiLCJNb3VzZUV2ZW50Iiwic2NyZWVuWCIsInNjcmVlblkiLCJjbGllbnRYIiwiY2xpZW50WSIsImNyZWF0ZUV2ZW50IiwiaW5pdE1vdXNlRXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiTXV0YXRpb25PYnNlcnZlciIsInByZWZpeGVzIiwidHJpZ2dlcnMiLCJzdG9wUHJvcGFnYXRpb24iLCJmYWRlT3V0IiwiY2hlY2tMaXN0ZW5lcnMiLCJldmVudHNMaXN0ZW5lciIsInJlc2l6ZUxpc3RlbmVyIiwic2Nyb2xsTGlzdGVuZXIiLCJtdXRhdGVMaXN0ZW5lciIsImNsb3NlbWVMaXN0ZW5lciIsInlldGlCb3hlcyIsInBsdWdOYW1lcyIsImxpc3RlbmVycyIsImpvaW4iLCJwbHVnaW5JZCIsIm5vdCIsImRlYm91bmNlIiwiJG5vZGVzIiwibm9kZXMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGlzdGVuaW5nRWxlbWVudHNNdXRhdGlvbiIsIm11dGF0aW9uUmVjb3Jkc0xpc3QiLCIkdGFyZ2V0IiwiYXR0cmlidXRlTmFtZSIsImNsb3Nlc3QiLCJlbGVtZW50T2JzZXJ2ZXIiLCJvYnNlcnZlIiwiYXR0cmlidXRlcyIsImNoaWxkTGlzdCIsImNoYXJhY3RlckRhdGEiLCJzdWJ0cmVlIiwiYXR0cmlidXRlRmlsdGVyIiwiSUhlYXJZb3UiLCJBYmlkZSIsImRlZmF1bHRzIiwiJGlucHV0cyIsIl9ldmVudHMiLCJyZXNldEZvcm0iLCJ2YWxpZGF0ZUZvcm0iLCJ2YWxpZGF0ZU9uIiwidmFsaWRhdGVJbnB1dCIsImxpdmVWYWxpZGF0ZSIsInZhbGlkYXRlT25CbHVyIiwiX3JlZmxvdyIsInJlcXVpcmVkQ2hlY2siLCJpc0dvb2QiLCJjaGVja2VkIiwiZmluZEZvcm1FcnJvciIsIiRlcnJvciIsInNpYmxpbmdzIiwiZm9ybUVycm9yU2VsZWN0b3IiLCJmaW5kTGFiZWwiLCIkbGFiZWwiLCJmaW5kUmFkaW9MYWJlbHMiLCIkZWxzIiwibGFiZWxzIiwiYWRkRXJyb3JDbGFzc2VzIiwiJGZvcm1FcnJvciIsImxhYmVsRXJyb3JDbGFzcyIsImZvcm1FcnJvckNsYXNzIiwiaW5wdXRFcnJvckNsYXNzIiwicmVtb3ZlUmFkaW9FcnJvckNsYXNzZXMiLCJncm91cE5hbWUiLCIkbGFiZWxzIiwiJGZvcm1FcnJvcnMiLCJyZW1vdmVFcnJvckNsYXNzZXMiLCJjbGVhclJlcXVpcmUiLCJ2YWxpZGF0ZWQiLCJjdXN0b21WYWxpZGF0b3IiLCJ2YWxpZGF0b3IiLCJlcXVhbFRvIiwidmFsaWRhdGVSYWRpbyIsInZhbGlkYXRlVGV4dCIsIm1hdGNoVmFsaWRhdGlvbiIsInZhbGlkYXRvcnMiLCJnb29kVG9HbyIsIm1lc3NhZ2UiLCJkZXBlbmRlbnRFbGVtZW50cyIsImFjYyIsIm5vRXJyb3IiLCJwYXR0ZXJuIiwiaW5wdXRUZXh0IiwidmFsaWQiLCJwYXR0ZXJucyIsIlJlZ0V4cCIsIiRncm91cCIsInJlcXVpcmVkIiwiY2xlYXIiLCJ2IiwiJGZvcm0iLCJkZXN0cm95IiwiYWxwaGEiLCJhbHBoYV9udW1lcmljIiwiaW50ZWdlciIsIm51bWJlciIsImNhcmQiLCJjdnYiLCJlbWFpbCIsInVybCIsImRvbWFpbiIsImRhdGV0aW1lIiwiZGF0ZSIsInRpbWUiLCJkYXRlSVNPIiwibW9udGhfZGF5X3llYXIiLCJkYXlfbW9udGhfeWVhciIsImNvbG9yIiwiQWNjb3JkaW9uIiwiJHRhYnMiLCJpZHgiLCIkY29udGVudCIsImxpbmtJZCIsIiRpbml0QWN0aXZlIiwiZG93biIsIiR0YWJDb250ZW50IiwidG9nZ2xlIiwibmV4dCIsIiRhIiwibXVsdGlFeHBhbmQiLCJwcmV2aW91cyIsInByZXYiLCJoYXNDbGFzcyIsInVwIiwiZmlyc3RUaW1lIiwiJGN1cnJlbnRBY3RpdmUiLCJzbGlkZURvd24iLCJzbGlkZVNwZWVkIiwiJGF1bnRzIiwiYWxsb3dBbGxDbG9zZWQiLCJzbGlkZVVwIiwic3RvcCIsIkFjY29yZGlvbk1lbnUiLCJtdWx0aU9wZW4iLCIkbWVudUxpbmtzIiwic3ViSWQiLCJpc0FjdGl2ZSIsImluaXRQYW5lcyIsIiRzdWJtZW51IiwiJGVsZW1lbnRzIiwiJHByZXZFbGVtZW50IiwiJG5leHRFbGVtZW50IiwibWluIiwicGFyZW50cyIsIm9wZW4iLCJjbG9zZSIsImNsb3NlQWxsIiwiaGlkZUFsbCIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsInNob3dBbGwiLCJwYXJlbnRzVW50aWwiLCJhZGQiLCIkbWVudXMiLCJEcmlsbGRvd24iLCIkc3VibWVudUFuY2hvcnMiLCIkc3VibWVudXMiLCIkbWVudUl0ZW1zIiwiX3ByZXBhcmVNZW51IiwiX3JlZ2lzdGVyRXZlbnRzIiwiX2tleWJvYXJkRXZlbnRzIiwiJGxpbmsiLCJwYXJlbnRMaW5rIiwiY2xvbmUiLCJwcmVwZW5kVG8iLCJ3cmFwIiwiJG1lbnUiLCIkYmFjayIsImJhY2tCdXR0b25Qb3NpdGlvbiIsImFwcGVuZCIsImJhY2tCdXR0b24iLCJwcmVwZW5kIiwiX2JhY2siLCJhdXRvSGVpZ2h0IiwiJHdyYXBwZXIiLCJ3cmFwcGVyIiwiYW5pbWF0ZUhlaWdodCIsIl9nZXRNYXhEaW1zIiwiX3Jlc2l6ZSIsIl9zaG93IiwiY2xvc2VPbkNsaWNrIiwiJGJvZHkiLCJjb250YWlucyIsIl9oaWRlQWxsIiwic2Nyb2xsVG9wIiwiX2JpbmRIYW5kbGVyIiwiX3Njcm9sbFRvcCIsIiRzY3JvbGxUb3BFbGVtZW50Iiwic2Nyb2xsVG9wRWxlbWVudCIsInNjcm9sbFBvcyIsInBhcnNlSW50Iiwic2Nyb2xsVG9wT2Zmc2V0IiwiYW5pbWF0aW9uRHVyYXRpb24iLCJhbmltYXRpb25FYXNpbmciLCJfaGlkZSIsInBhcmVudFN1Yk1lbnUiLCJfbWVudUxpbmtFdmVudHMiLCJibHVyIiwibWF4SGVpZ2h0IiwicmVzdWx0IiwibnVtT2ZFbGVtcyIsInVud3JhcCIsInJlbW92ZSIsIkRyb3Bkb3duIiwiJGlkIiwiJGFuY2hvciIsInBhcmVudENsYXNzIiwiJHBhcmVudCIsInBvc2l0aW9uQ2xhc3MiLCJnZXRQb3NpdGlvbkNsYXNzIiwiY291bnRlciIsInVzZWRQb3NpdGlvbnMiLCJ2ZXJ0aWNhbFBvc2l0aW9uIiwibWF0Y2giLCJob3Jpem9udGFsUG9zaXRpb24iLCJfcmVwb3NpdGlvbiIsImNsYXNzQ2hhbmdlZCIsIl9zZXRQb3NpdGlvbiIsImRpcmVjdGlvbiIsIm5ld1dpZHRoIiwicGFyZW50SE9mZnNldCIsIiRwYXJlbnREaW1zIiwiaG92ZXIiLCJib2R5RGF0YSIsIndoYXRpbnB1dCIsInRpbWVvdXQiLCJob3ZlckRlbGF5IiwiaG92ZXJQYW5lIiwidmlzaWJsZUZvY3VzYWJsZUVsZW1lbnRzIiwiX2FkZEJvZHlIYW5kbGVyIiwiYXV0b0ZvY3VzIiwiY3VyUG9zaXRpb25DbGFzcyIsIkRyb3Bkb3duTWVudSIsInN1YnMiLCJ2ZXJ0aWNhbENsYXNzIiwicmlnaHRDbGFzcyIsImFsaWdubWVudCIsImNoYW5nZWQiLCJfaXNWZXJ0aWNhbCIsImhhc1RvdWNoIiwib250b3VjaHN0YXJ0IiwicGFyQ2xhc3MiLCJoYW5kbGVDbGlja0ZuIiwiaGFzU3ViIiwiaGFzQ2xpY2tlZCIsImNsaWNrT3BlbiIsImZvcmNlRm9sbG93IiwiY2xvc2VPbkNsaWNrSW5zaWRlIiwiZGlzYWJsZUhvdmVyIiwiYXV0b2Nsb3NlIiwiY2xvc2luZ1RpbWUiLCJpc1RhYiIsImluZGV4IiwibmV4dFNpYmxpbmciLCJwcmV2U2libGluZyIsIm9wZW5TdWIiLCJjbG9zZVN1YiIsIiRzaWJzIiwib2xkQ2xhc3MiLCIkcGFyZW50TGkiLCIkdG9DbG9zZSIsInNvbWV0aGluZ1RvQ2xvc2UiLCJFcXVhbGl6ZXIiLCJlcUlkIiwiJHdhdGNoZWQiLCJoYXNOZXN0ZWQiLCJpc05lc3RlZCIsImlzT24iLCJvblJlc2l6ZU1lQm91bmQiLCJfb25SZXNpemVNZSIsIm9uUG9zdEVxdWFsaXplZEJvdW5kIiwiX29uUG9zdEVxdWFsaXplZCIsImltZ3MiLCJ0b29TbWFsbCIsImVxdWFsaXplT24iLCJfY2hlY2tNUSIsIl9wYXVzZUV2ZW50cyIsIl9raWxsc3dpdGNoIiwiZXF1YWxpemVPblN0YWNrIiwiX2lzU3RhY2tlZCIsImVxdWFsaXplQnlSb3ciLCJnZXRIZWlnaHRzQnlSb3ciLCJhcHBseUhlaWdodEJ5Um93IiwiZ2V0SGVpZ2h0cyIsImFwcGx5SGVpZ2h0IiwiaGVpZ2h0cyIsImxlbiIsIm9mZnNldEhlaWdodCIsImxhc3RFbFRvcE9mZnNldCIsImdyb3VwcyIsImdyb3VwIiwiZWxPZmZzZXRUb3AiLCJqIiwibG4iLCJncm91cHNJTGVuZ3RoIiwibGVuSiIsIkludGVyY2hhbmdlIiwicnVsZXMiLCJjdXJyZW50UGF0aCIsIl9hZGRCcmVha3BvaW50cyIsIl9nZW5lcmF0ZVJ1bGVzIiwicnVsZSIsInBhdGgiLCJTUEVDSUFMX1FVRVJJRVMiLCJydWxlc0xpc3QiLCJub2RlTmFtZSIsInJlc3BvbnNlIiwiaHRtbCIsIk1hZ2VsbGFuIiwiY2FsY1BvaW50cyIsIiR0YXJnZXRzIiwiJGxpbmtzIiwiJGFjdGl2ZSIsInBvaW50cyIsIndpbkhlaWdodCIsImlubmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwiZG9jSGVpZ2h0Iiwic2Nyb2xsSGVpZ2h0IiwiJHRhciIsInB0IiwidGhyZXNob2xkIiwidGFyZ2V0UG9pbnQiLCJlYXNpbmciLCJkZWVwTGlua2luZyIsImxvY2F0aW9uIiwiaGFzaCIsInNjcm9sbFRvTG9jIiwiX3VwZGF0ZUFjdGl2ZSIsImFycml2YWwiLCJnZXRBdHRyaWJ1dGUiLCJsb2MiLCJfaW5UcmFuc2l0aW9uIiwiYmFyT2Zmc2V0Iiwid2luUG9zIiwiY3VySWR4IiwiaXNEb3duIiwiY3VyVmlzaWJsZSIsImhpc3RvcnkiLCJwdXNoU3RhdGUiLCJPZmZDYW52YXMiLCIkbGFzdFRyaWdnZXIiLCIkdHJpZ2dlcnMiLCJ0cmFuc2l0aW9uIiwiY29udGVudE92ZXJsYXkiLCJvdmVybGF5Iiwib3ZlcmxheVBvc2l0aW9uIiwic2V0QXR0cmlidXRlIiwiJG92ZXJsYXkiLCJpc1JldmVhbGVkIiwicmV2ZWFsQ2xhc3MiLCJyZXZlYWxPbiIsIl9zZXRNUUNoZWNrZXIiLCJ0cmFuc2l0aW9uVGltZSIsIl9oYW5kbGVLZXlib2FyZCIsInJldmVhbCIsIiRjbG9zZXIiLCJfc3RvcFNjcm9sbGluZyIsImZvcmNlVG8iLCJzY3JvbGxUbyIsImNvbnRlbnRTY3JvbGwiLCJPcmJpdCIsIl9yZXNldCIsImNvbnRhaW5lckNsYXNzIiwiJHNsaWRlcyIsInNsaWRlQ2xhc3MiLCIkaW1hZ2VzIiwiaW5pdEFjdGl2ZSIsInVzZU1VSSIsIl9wcmVwYXJlRm9yT3JiaXQiLCJidWxsZXRzIiwiX2xvYWRCdWxsZXRzIiwiYXV0b1BsYXkiLCJnZW9TeW5jIiwiYWNjZXNzaWJsZSIsIiRidWxsZXRzIiwiYm94T2ZCdWxsZXRzIiwidGltZXJEZWxheSIsImNoYW5nZVNsaWRlIiwiX3NldFdyYXBwZXJIZWlnaHQiLCJ0ZW1wIiwiX3NldFNsaWRlSGVpZ2h0IiwicGF1c2VPbkhvdmVyIiwibmF2QnV0dG9ucyIsIiRjb250cm9scyIsIm5leHRDbGFzcyIsInByZXZDbGFzcyIsIiRzbGlkZSIsIl91cGRhdGVCdWxsZXRzIiwiaXNMVFIiLCJjaG9zZW5TbGlkZSIsIiRjdXJTbGlkZSIsIiRmaXJzdFNsaWRlIiwiJGxhc3RTbGlkZSIsImxhc3QiLCJkaXJJbiIsImRpck91dCIsIiRuZXdTbGlkZSIsImluZmluaXRlV3JhcCIsIiRvbGRCdWxsZXQiLCJzcGFuIiwiZGV0YWNoIiwiJG5ld0J1bGxldCIsImFuaW1JbkZyb21SaWdodCIsImFuaW1PdXRUb1JpZ2h0IiwiYW5pbUluRnJvbUxlZnQiLCJhbmltT3V0VG9MZWZ0IiwiUmVzcG9uc2l2ZU1lbnUiLCJjdXJyZW50TXEiLCJjdXJyZW50UGx1Z2luIiwicnVsZXNUcmVlIiwicnVsZVNpemUiLCJydWxlUGx1Z2luIiwiTWVudVBsdWdpbnMiLCJpc0VtcHR5T2JqZWN0IiwiX2NoZWNrTWVkaWFRdWVyaWVzIiwibWF0Y2hlZE1xIiwiY3NzQ2xhc3MiLCJkcm9wZG93biIsImRyaWxsZG93biIsImFjY29yZGlvbiIsIlJlc3BvbnNpdmVUb2dnbGUiLCJ0YXJnZXRJRCIsIiR0YXJnZXRNZW51IiwiJHRvZ2dsZXIiLCJpbnB1dCIsImFuaW1hdGlvbkluIiwiYW5pbWF0aW9uT3V0IiwiX3VwZGF0ZSIsIl91cGRhdGVNcUhhbmRsZXIiLCJ0b2dnbGVNZW51IiwiaGlkZUZvciIsIlJldmVhbCIsImNhY2hlZCIsIm1xIiwiaXNNb2JpbGUiLCJtb2JpbGVTbmlmZiIsImZ1bGxTY3JlZW4iLCJfbWFrZU92ZXJsYXkiLCJkZWVwTGluayIsIl91cGRhdGVQb3NpdGlvbiIsIm91dGVyV2lkdGgiLCJvdXRlckhlaWdodCIsIm1hcmdpbiIsIl9oYW5kbGVTdGF0ZSIsIm11bHRpcGxlT3BlbmVkIiwiYWRkUmV2ZWFsT3BlbkNsYXNzZXMiLCJvcmlnaW5hbFNjcm9sbFBvcyIsImFmdGVyQW5pbWF0aW9uIiwiZm9jdXNhYmxlRWxlbWVudHMiLCJzaG93RGVsYXkiLCJfZXh0cmFIYW5kbGVycyIsImNsb3NlT25Fc2MiLCJmaW5pc2hVcCIsImhpZGVEZWxheSIsInJlc2V0T25DbG9zZSIsInJlcGxhY2VTdGF0ZSIsInRpdGxlIiwiaHJlZiIsImJ0bU9mZnNldFBjdCIsImlQaG9uZVNuaWZmIiwiYW5kcm9pZFNuaWZmIiwiU2xpZGVyIiwiaW5wdXRzIiwiaGFuZGxlcyIsIiRoYW5kbGUiLCIkaW5wdXQiLCIkZmlsbCIsInZlcnRpY2FsIiwiaXNEYmwiLCJkaXNhYmxlZCIsImRpc2FibGVkQ2xhc3MiLCJiaW5kaW5nIiwiX3NldEluaXRBdHRyIiwiZG91YmxlU2lkZWQiLCIkaGFuZGxlMiIsIiRpbnB1dDIiLCJzZXRIYW5kbGVzIiwiX3NldEhhbmRsZVBvcyIsIl9wY3RPZkJhciIsInBjdE9mQmFyIiwicGVyY2VudCIsInBvc2l0aW9uVmFsdWVGdW5jdGlvbiIsIl9sb2dUcmFuc2Zvcm0iLCJfcG93VHJhbnNmb3JtIiwidG9GaXhlZCIsIl92YWx1ZSIsImJhc2VMb2ciLCJub25MaW5lYXJCYXNlIiwiJGhuZGwiLCJub0ludmVydCIsImgyVmFsIiwic3RlcCIsImgxVmFsIiwidmVydCIsImhPclciLCJsT3JUIiwiaGFuZGxlRGltIiwiZWxlbURpbSIsInB4VG9Nb3ZlIiwibW92ZW1lbnQiLCJkZWNpbWFsIiwiX3NldFZhbHVlcyIsImlzTGVmdEhuZGwiLCJkaW0iLCJoYW5kbGVQY3QiLCJoYW5kbGVQb3MiLCJpbml0aWFsU3RhcnQiLCJtb3ZlVGltZSIsImNoYW5nZWREZWxheSIsImluaXRWYWwiLCJpbml0aWFsRW5kIiwiX2hhbmRsZUV2ZW50IiwiaGFzVmFsIiwiZXZlbnRPZmZzZXQiLCJoYWxmT2ZIYW5kbGUiLCJiYXJEaW0iLCJ3aW5kb3dTY3JvbGwiLCJzY3JvbGxMZWZ0IiwiZWxlbU9mZnNldCIsImV2ZW50RnJvbUJhciIsImJhclhZIiwib2Zmc2V0UGN0IiwiX2FkanVzdFZhbHVlIiwiZmlyc3RIbmRsUG9zIiwiYWJzUG9zaXRpb24iLCJzZWNuZEhuZGxQb3MiLCJkaXYiLCJwcmV2X3ZhbCIsIm5leHRfdmFsIiwiX2V2ZW50c0ZvckhhbmRsZSIsImN1ckhhbmRsZSIsImNsaWNrU2VsZWN0IiwiZHJhZ2dhYmxlIiwiY3VycmVudFRhcmdldCIsIl8kaGFuZGxlIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsImRlY3JlYXNlIiwiaW5jcmVhc2UiLCJkZWNyZWFzZV9mYXN0IiwiaW5jcmVhc2VfZmFzdCIsImludmVydFZlcnRpY2FsIiwiZnJhYyIsIm51bSIsImNsaWNrUG9zIiwiYmFzZSIsImxvZyIsIlN0aWNreSIsIndhc1dyYXBwZWQiLCIkY29udGFpbmVyIiwiY29udGFpbmVyIiwid3JhcElubmVyIiwic3RpY2t5Q2xhc3MiLCJzY3JvbGxDb3VudCIsImNoZWNrRXZlcnkiLCJpc1N0dWNrIiwiY29udGFpbmVySGVpZ2h0IiwiZWxlbUhlaWdodCIsIl9wYXJzZVBvaW50cyIsIl9zZXRTaXplcyIsInNjcm9sbCIsIl9jYWxjIiwiX3JlbW92ZVN0aWNreSIsInRvcFBvaW50IiwicmV2ZXJzZSIsInRvcEFuY2hvciIsImJ0bSIsImJ0bUFuY2hvciIsInB0cyIsImJyZWFrcyIsInBsYWNlIiwiY2FuU3RpY2siLCJfcGF1c2VMaXN0ZW5lcnMiLCJjaGVja1NpemVzIiwiYm90dG9tUG9pbnQiLCJfc2V0U3RpY2t5Iiwic3RpY2tUbyIsIm1yZ24iLCJub3RTdHVja1RvIiwiaXNUb3AiLCJzdGlja1RvVG9wIiwiYW5jaG9yUHQiLCJhbmNob3JIZWlnaHQiLCJ0b3BPckJvdHRvbSIsInN0aWNreU9uIiwibmV3RWxlbVdpZHRoIiwiY29tcCIsInBkbmdsIiwicGRuZ3IiLCJuZXdDb250YWluZXJIZWlnaHQiLCJfc2V0QnJlYWtQb2ludHMiLCJtVG9wIiwiZW1DYWxjIiwibWFyZ2luVG9wIiwibUJ0bSIsIm1hcmdpbkJvdHRvbSIsImVtIiwiZm9udFNpemUiLCJUYWJzIiwiJHRhYlRpdGxlcyIsImxpbmtDbGFzcyIsImxpbmtBY3RpdmVDbGFzcyIsImxvYWQiLCJkZWVwTGlua1NtdWRnZURlbGF5Iiwic2VsZWN0VGFiIiwiZGVlcExpbmtTbXVkZ2UiLCJtYXRjaEhlaWdodCIsIl9zZXRIZWlnaHQiLCJfYWRkS2V5SGFuZGxlciIsIl9hZGRDbGlja0hhbmRsZXIiLCJfc2V0SGVpZ2h0TXFIYW5kbGVyIiwiX2hhbmRsZVRhYkNoYW5nZSIsIndyYXBPbktleXMiLCJhY3RpdmVDb2xsYXBzZSIsIl9jb2xsYXBzZVRhYiIsIiRvbGRUYWIiLCIkdGFiTGluayIsIiR0YXJnZXRDb250ZW50IiwiX29wZW5UYWIiLCJ1cGRhdGVIaXN0b3J5IiwicGFuZWxBY3RpdmVDbGFzcyIsIiR0YXJnZXRfYW5jaG9yIiwiaWRTdHIiLCJwYW5lbENsYXNzIiwicGFuZWwiLCJUb2dnbGVyIiwiX3RvZ2dsZUNsYXNzIiwidG9nZ2xlQ2xhc3MiLCJfdXBkYXRlQVJJQSIsIl90b2dnbGVBbmltYXRlIiwiVG9vbHRpcCIsImlzQ2xpY2siLCJlbGVtSWQiLCJfZ2V0UG9zaXRpb25DbGFzcyIsInRpcFRleHQiLCJ0ZW1wbGF0ZSIsIl9idWlsZFRlbXBsYXRlIiwiYWxsb3dIdG1sIiwidHJpZ2dlckNsYXNzIiwidGVtcGxhdGVDbGFzc2VzIiwidG9vbHRpcENsYXNzIiwiJHRlbXBsYXRlIiwiJHRpcERpbXMiLCJzaG93T24iLCJmYWRlSW4iLCJmYWRlSW5EdXJhdGlvbiIsImZhZGVPdXREdXJhdGlvbiIsImlzRm9jdXMiLCJkaXNhYmxlRm9yVG91Y2giLCJ0b3VjaENsb3NlVGV4dCIsImVuZEV2ZW50IiwiTW90aW9uVUkiLCJib3R0b21fb2Zfb2JqZWN0IiwiYm90dG9tX29mX3dpbmRvdyIsImdvdG9fdG9wIiwiY2xpY2siLCJyZWFkeSIsImluaXRNYXAiLCJzdHlsZWRNYXBUeXBlIiwiZ29vZ2xlIiwibWFwcyIsIlN0eWxlZE1hcFR5cGUiLCJNYXAiLCJnZXRFbGVtZW50QnlJZCIsInpvb20iLCJjZW50ZXIiLCJsYXQiLCJsbmciLCJtYXBUeXBlcyIsInNldCIsInNldE1hcFR5cGVJZCIsImltYWdlIiwiYmVhY2hNYXJrZXIiLCJNYXJrZXIiLCJpY29uIiwidmlkZW9zIiwiZm9vdGVyIiwicG9zIiwic3RpY2t5Rm9vdGVyIl0sIm1hcHBpbmdzIjoiQUFBQSxDQUFDLFVBQVNBLENBQVQsRUFBWTs7QUFFYjs7QUFFQSxNQUFJQyxxQkFBcUIsT0FBekI7O0FBRUE7QUFDQTtBQUNBLE1BQUlDLGFBQWE7QUFDZkMsYUFBU0Ysa0JBRE07O0FBR2Y7OztBQUdBRyxjQUFVLEVBTks7O0FBUWY7OztBQUdBQyxZQUFRLEVBWE87O0FBYWY7OztBQUdBQyxTQUFLLFlBQVU7QUFDYixhQUFPTixFQUFFLE1BQUYsRUFBVU8sSUFBVixDQUFlLEtBQWYsTUFBMEIsS0FBakM7QUFDRCxLQWxCYztBQW1CZjs7OztBQUlBQyxZQUFRLFVBQVNBLE1BQVQsRUFBaUJDLElBQWpCLEVBQXVCO0FBQzdCO0FBQ0E7QUFDQSxVQUFJQyxZQUFhRCxRQUFRRSxhQUFhSCxN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QUFGLEVBQWV1TixFQUFmLENBQWtCLE9BQWxCLEVBQTJCLFlBQVc7QUFDcEN2TixJQUFFNEUsUUFBRixFQUFZbkMsVUFBWixDQUF1QixTQUF2QixFQUFpQyxPQUFqQztBQUNELENBRkQ7Q0NEQTtFQ0FBekMsRUFBRTRFLFFBQUYsRUFBWW83QixLQUFaLENBQWtCLFlBQVk7QUFDMUIsUUFBSW1CLFNBQVNuaEMsRUFBRSxzREFBRixDQUFiOztBQUVBbWhDLFdBQU9sL0IsSUFBUCxDQUFZLFlBQVk7QUFDcEIsWUFBSW9DLEtBQUtyRSxFQUFFLElBQUYsQ0FBVDtBQUNBcUUsV0FBRytjLElBQUgsQ0FBUSw0Q0FBUjtBQUNILEtBSEQ7QUFJSCxDQVBEOztBQ0NBcGhCLEVBQUUwRyxNQUFGLEVBQVVvQixJQUFWLENBQWUsaUNBQWYsRUFBa0QsWUFBWTtBQUMzRCxPQUFJczVCLFNBQVNwaEMsRUFBRSxtQkFBRixDQUFiO0FBQ0EsT0FBSXFoQyxNQUFNRCxPQUFPdjJCLFFBQVAsRUFBVjtBQUNBLE9BQUlqQixTQUFTNUosRUFBRTBHLE1BQUYsRUFBVWtELE1BQVYsRUFBYjtBQUNBQSxZQUFTQSxTQUFTeTNCLElBQUkvM0IsR0FBdEI7QUFDQU0sWUFBU0EsU0FBU3czQixPQUFPeDNCLE1BQVAsRUFBVCxHQUEwQixDQUFuQzs7QUFFQSxZQUFTMDNCLFlBQVQsR0FBd0I7QUFDdEJGLGFBQU81eUIsR0FBUCxDQUFXO0FBQ1AsdUJBQWM1RSxTQUFTO0FBRGhCLE9BQVg7QUFHRDs7QUFFRCxPQUFJQSxTQUFTLENBQWIsRUFBZ0I7QUFDZDAzQjtBQUNEO0FBQ0gsQ0FoQkQiLCJmaWxlIjoiZm91bmRhdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIiFmdW5jdGlvbigkKSB7XHJcblxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBGT1VOREFUSU9OX1ZFUlNJT04gPSAnNi4zLjAnO1xyXG5cclxuLy8gR2xvYmFsIEZvdW5kYXRpb24gb2JqZWN0XHJcbi8vIFRoaXMgaXMgYXR0YWNoZWQgdG8gdGhlIHdpbmRvdywgb3IgdXNlZCBhcyBhIG1vZHVsZSBmb3IgQU1EL0Jyb3dzZXJpZnlcclxudmFyIEZvdW5kYXRpb24gPSB7XHJcbiAgdmVyc2lvbjogRk9VTkRBVElPTl9WRVJTSU9OLFxyXG5cclxuICAvKipcclxuICAgKiBTdG9yZXMgaW5pdGlhbGl6ZWQgcGx1Z2lucy5cclxuICAgKi9cclxuICBfcGx1Z2luczoge30sXHJcblxyXG4gIC8qKlxyXG4gICAqIFN0b3JlcyBnZW5lcmF0ZWQgdW5pcXVlIGlkcyBmb3IgcGx1Z2luIGluc3RhbmNlc1xyXG4gICAqL1xyXG4gIF91dWlkczogW10sXHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgYSBib29sZWFuIGZvciBSVEwgc3VwcG9ydFxyXG4gICAqL1xyXG4gIHJ0bDogZnVuY3Rpb24oKXtcclxuICAgIHJldHVybiAkKCdodG1sJykuYXR0cignZGlyJykgPT09ICdydGwnO1xyXG4gIH0sXHJcbiAgLyoqXHJcbiAgICogRGVmaW5lcyBhIEZvdW5kYXRpb24gcGx1Z2luLCBhZGRpbmcgaXQgdG8gdGhlIGBGb3VuZGF0aW9uYCBuYW1lc3BhY2UgYW5kIHRoZSBsaXN0IG9mIHBsdWdpbnMgdG8gaW5pdGlhbGl6ZSB3aGVuIHJlZmxvd2luZy5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gcGx1Z2luIC0gVGhlIGNvbnN0cnVjdG9yIG9mIHRoZSBwbHVnaW4uXHJcbiAgICovXHJcbiAgcGx1Z2luOiBmdW5jdGlvbihwbHVnaW4sIG5hbWUpIHtcclxuICAgIC8vIE9iamVjdCBrZXkgdG8gdXNlIHdoZW4gYWRkaW5nIHRvIGdsb2JhbCBGb3VuZGF0aW9uIG9iamVjdFxyXG4gICAgLy8gRXhhbXBsZXM6IEZvdW5kYXRpb24uUmV2ZWFsLCBGb3VuZGF0aW9uLk9mZkNhbnZhc1xyXG4gICAgdmFyIGNsYXNzTmFtZSA9IChuYW1lIHx8IGZ1bmN0aW9uTmFtZShwbHVnaW4pKTtcclxuICAgIC8vIE9iamVjdCBrZXkgdG8gdXNlIHdoZW4gc3RvcmluZyB0aGUgcGx1Z2luLCBhbHNvIHVzZWQgdG8gY3JlYXRlIHRoZSBpZGVudGlmeWluZyBkYXRhIGF0dHJpYnV0ZSBmb3IgdGhlIHBsdWdpblxyXG4gICAgLy8gRXhhbXBsZXM6IGRhdGEtcmV2ZWFsLCBkYXRhLW9mZi1jYW52YXNcclxuICAgIHZhciBhdHRyTmFtZSAgPSBoeXBoZW5hdGUoY2xhc3NOYW1lKTtcclxuXHJcbiAgICAvLyBBZGQgdG8gdGhlIEZvdW5kYXRpb24gb2JqZWN0IGFuZCB0aGUgcGx1Z2lucyBsaXN0IChmb3IgcmVmbG93aW5nKVxyXG4gICAgdGhpcy5fcGx1Z2luc1thdHRyTmFtZV0gPSB0aGlzW2NsYXNzTmFtZV0gPSBwbHVnaW47XHJcbiAgfSxcclxuICAvKipcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBQb3B1bGF0ZXMgdGhlIF91dWlkcyBhcnJheSB3aXRoIHBvaW50ZXJzIHRvIGVhY2ggaW5kaXZpZHVhbCBwbHVnaW4gaW5zdGFuY2UuXHJcbiAgICogQWRkcyB0aGUgYHpmUGx1Z2luYCBkYXRhLWF0dHJpYnV0ZSB0byBwcm9ncmFtbWF0aWNhbGx5IGNyZWF0ZWQgcGx1Z2lucyB0byBhbGxvdyB1c2Ugb2YgJChzZWxlY3RvcikuZm91bmRhdGlvbihtZXRob2QpIGNhbGxzLlxyXG4gICAqIEFsc28gZmlyZXMgdGhlIGluaXRpYWxpemF0aW9uIGV2ZW50IGZvciBlYWNoIHBsdWdpbiwgY29uc29saWRhdGluZyByZXBldGl0aXZlIGNvZGUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IHBsdWdpbiAtIGFuIGluc3RhbmNlIG9mIGEgcGx1Z2luLCB1c3VhbGx5IGB0aGlzYCBpbiBjb250ZXh0LlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gdGhlIG5hbWUgb2YgdGhlIHBsdWdpbiwgcGFzc2VkIGFzIGEgY2FtZWxDYXNlZCBzdHJpbmcuXHJcbiAgICogQGZpcmVzIFBsdWdpbiNpbml0XHJcbiAgICovXHJcbiAgcmVnaXN0ZXJQbHVnaW46IGZ1bmN0aW9uKHBsdWdpbiwgbmFtZSl7XHJcbiAgICB2YXIgcGx1Z2luTmFtZSA9IG5hbWUgPyBoeXBoZW5hdGUobmFtZSkgOiBmdW5jdGlvbk5hbWUocGx1Z2luLmNvbnN0cnVjdG9yKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgcGx1Z2luLnV1aWQgPSB0aGlzLkdldFlvRGlnaXRzKDYsIHBsdWdpbk5hbWUpO1xyXG5cclxuICAgIGlmKCFwbHVnaW4uJGVsZW1lbnQuYXR0cihgZGF0YS0ke3BsdWdpbk5hbWV9YCkpeyBwbHVnaW4uJGVsZW1lbnQuYXR0cihgZGF0YS0ke3BsdWdpbk5hbWV9YCwgcGx1Z2luLnV1aWQpOyB9XHJcbiAgICBpZighcGx1Z2luLiRlbGVtZW50LmRhdGEoJ3pmUGx1Z2luJykpeyBwbHVnaW4uJGVsZW1lbnQuZGF0YSgnemZQbHVnaW4nLCBwbHVnaW4pOyB9XHJcbiAgICAgICAgICAvKipcclxuICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIHBsdWdpbiBoYXMgaW5pdGlhbGl6ZWQuXHJcbiAgICAgICAgICAgKiBAZXZlbnQgUGx1Z2luI2luaXRcclxuICAgICAgICAgICAqL1xyXG4gICAgcGx1Z2luLiRlbGVtZW50LnRyaWdnZXIoYGluaXQuemYuJHtwbHVnaW5OYW1lfWApO1xyXG5cclxuICAgIHRoaXMuX3V1aWRzLnB1c2gocGx1Z2luLnV1aWQpO1xyXG5cclxuICAgIHJldHVybjtcclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIFJlbW92ZXMgdGhlIHBsdWdpbnMgdXVpZCBmcm9tIHRoZSBfdXVpZHMgYXJyYXkuXHJcbiAgICogUmVtb3ZlcyB0aGUgemZQbHVnaW4gZGF0YSBhdHRyaWJ1dGUsIGFzIHdlbGwgYXMgdGhlIGRhdGEtcGx1Z2luLW5hbWUgYXR0cmlidXRlLlxyXG4gICAqIEFsc28gZmlyZXMgdGhlIGRlc3Ryb3llZCBldmVudCBmb3IgdGhlIHBsdWdpbiwgY29uc29saWRhdGluZyByZXBldGl0aXZlIGNvZGUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IHBsdWdpbiAtIGFuIGluc3RhbmNlIG9mIGEgcGx1Z2luLCB1c3VhbGx5IGB0aGlzYCBpbiBjb250ZXh0LlxyXG4gICAqIEBmaXJlcyBQbHVnaW4jZGVzdHJveWVkXHJcbiAgICovXHJcbiAgdW5yZWdpc3RlclBsdWdpbjogZnVuY3Rpb24ocGx1Z2luKXtcclxuICAgIHZhciBwbHVnaW5OYW1lID0gaHlwaGVuYXRlKGZ1bmN0aW9uTmFtZShwbHVnaW4uJGVsZW1lbnQuZGF0YSgnemZQbHVnaW4nKS5jb25zdHJ1Y3RvcikpO1xyXG5cclxuICAgIHRoaXMuX3V1aWRzLnNwbGljZSh0aGlzLl91dWlkcy5pbmRleE9mKHBsdWdpbi51dWlkKSwgMSk7XHJcbiAgICBwbHVnaW4uJGVsZW1lbnQucmVtb3ZlQXR0cihgZGF0YS0ke3BsdWdpbk5hbWV9YCkucmVtb3ZlRGF0YSgnemZQbHVnaW4nKVxyXG4gICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBwbHVnaW4gaGFzIGJlZW4gZGVzdHJveWVkLlxyXG4gICAgICAgICAgICogQGV2ZW50IFBsdWdpbiNkZXN0cm95ZWRcclxuICAgICAgICAgICAqL1xyXG4gICAgICAgICAgLnRyaWdnZXIoYGRlc3Ryb3llZC56Zi4ke3BsdWdpbk5hbWV9YCk7XHJcbiAgICBmb3IodmFyIHByb3AgaW4gcGx1Z2luKXtcclxuICAgICAgcGx1Z2luW3Byb3BdID0gbnVsbDsvL2NsZWFuIHVwIHNjcmlwdCB0byBwcmVwIGZvciBnYXJiYWdlIGNvbGxlY3Rpb24uXHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQ2F1c2VzIG9uZSBvciBtb3JlIGFjdGl2ZSBwbHVnaW5zIHRvIHJlLWluaXRpYWxpemUsIHJlc2V0dGluZyBldmVudCBsaXN0ZW5lcnMsIHJlY2FsY3VsYXRpbmcgcG9zaXRpb25zLCBldGMuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBsdWdpbnMgLSBvcHRpb25hbCBzdHJpbmcgb2YgYW4gaW5kaXZpZHVhbCBwbHVnaW4ga2V5LCBhdHRhaW5lZCBieSBjYWxsaW5nIGAkKGVsZW1lbnQpLmRhdGEoJ3BsdWdpbk5hbWUnKWAsIG9yIHN0cmluZyBvZiBhIHBsdWdpbiBjbGFzcyBpLmUuIGAnZHJvcGRvd24nYFxyXG4gICAqIEBkZWZhdWx0IElmIG5vIGFyZ3VtZW50IGlzIHBhc3NlZCwgcmVmbG93IGFsbCBjdXJyZW50bHkgYWN0aXZlIHBsdWdpbnMuXHJcbiAgICovXHJcbiAgIHJlSW5pdDogZnVuY3Rpb24ocGx1Z2lucyl7XHJcbiAgICAgdmFyIGlzSlEgPSBwbHVnaW5zIGluc3RhbmNlb2YgJDtcclxuICAgICB0cnl7XHJcbiAgICAgICBpZihpc0pRKXtcclxuICAgICAgICAgcGx1Z2lucy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgJCh0aGlzKS5kYXRhKCd6ZlBsdWdpbicpLl9pbml0KCk7XHJcbiAgICAgICAgIH0pO1xyXG4gICAgICAgfWVsc2V7XHJcbiAgICAgICAgIHZhciB0eXBlID0gdHlwZW9mIHBsdWdpbnMsXHJcbiAgICAgICAgIF90aGlzID0gdGhpcyxcclxuICAgICAgICAgZm5zID0ge1xyXG4gICAgICAgICAgICdvYmplY3QnOiBmdW5jdGlvbihwbGdzKXtcclxuICAgICAgICAgICAgIHBsZ3MuZm9yRWFjaChmdW5jdGlvbihwKXtcclxuICAgICAgICAgICAgICAgcCA9IGh5cGhlbmF0ZShwKTtcclxuICAgICAgICAgICAgICAgJCgnW2RhdGEtJysgcCArJ10nKS5mb3VuZGF0aW9uKCdfaW5pdCcpO1xyXG4gICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgfSxcclxuICAgICAgICAgICAnc3RyaW5nJzogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgIHBsdWdpbnMgPSBoeXBoZW5hdGUocGx1Z2lucyk7XHJcbiAgICAgICAgICAgICAkKCdbZGF0YS0nKyBwbHVnaW5zICsnXScpLmZvdW5kYXRpb24oJ19pbml0Jyk7XHJcbiAgICAgICAgICAgfSxcclxuICAgICAgICAgICAndW5kZWZpbmVkJzogZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgIHRoaXNbJ29iamVjdCddKE9iamVjdC5rZXlzKF90aGlzLl9wbHVnaW5zKSk7XHJcbiAgICAgICAgICAgfVxyXG4gICAgICAgICB9O1xyXG4gICAgICAgICBmbnNbdHlwZV0ocGx1Z2lucyk7XHJcbiAgICAgICB9XHJcbiAgICAgfWNhdGNoKGVycil7XHJcbiAgICAgICBjb25zb2xlLmVycm9yKGVycik7XHJcbiAgICAgfWZpbmFsbHl7XHJcbiAgICAgICByZXR1cm4gcGx1Z2lucztcclxuICAgICB9XHJcbiAgIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIHJldHVybnMgYSByYW5kb20gYmFzZS0zNiB1aWQgd2l0aCBuYW1lc3BhY2luZ1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBsZW5ndGggLSBudW1iZXIgb2YgcmFuZG9tIGJhc2UtMzYgZGlnaXRzIGRlc2lyZWQuIEluY3JlYXNlIGZvciBtb3JlIHJhbmRvbSBzdHJpbmdzLlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2UgLSBuYW1lIG9mIHBsdWdpbiB0byBiZSBpbmNvcnBvcmF0ZWQgaW4gdWlkLCBvcHRpb25hbC5cclxuICAgKiBAZGVmYXVsdCB7U3RyaW5nfSAnJyAtIGlmIG5vIHBsdWdpbiBuYW1lIGlzIHByb3ZpZGVkLCBub3RoaW5nIGlzIGFwcGVuZGVkIHRvIHRoZSB1aWQuXHJcbiAgICogQHJldHVybnMge1N0cmluZ30gLSB1bmlxdWUgaWRcclxuICAgKi9cclxuICBHZXRZb0RpZ2l0czogZnVuY3Rpb24obGVuZ3RoLCBuYW1lc3BhY2Upe1xyXG4gICAgbGVuZ3RoID0gbGVuZ3RoIHx8IDY7XHJcbiAgICByZXR1cm4gTWF0aC5yb3VuZCgoTWF0aC5wb3coMzYsIGxlbmd0aCArIDEpIC0gTWF0aC5yYW5kb20oKSAqIE1hdGgucG93KDM2LCBsZW5ndGgpKSkudG9TdHJpbmcoMzYpLnNsaWNlKDEpICsgKG5hbWVzcGFjZSA/IGAtJHtuYW1lc3BhY2V9YCA6ICcnKTtcclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemUgcGx1Z2lucyBvbiBhbnkgZWxlbWVudHMgd2l0aGluIGBlbGVtYCAoYW5kIGBlbGVtYCBpdHNlbGYpIHRoYXQgYXJlbid0IGFscmVhZHkgaW5pdGlhbGl6ZWQuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW0gLSBqUXVlcnkgb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnQgdG8gY2hlY2sgaW5zaWRlLiBBbHNvIGNoZWNrcyB0aGUgZWxlbWVudCBpdHNlbGYsIHVubGVzcyBpdCdzIHRoZSBgZG9jdW1lbnRgIG9iamVjdC5cclxuICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheX0gcGx1Z2lucyAtIEEgbGlzdCBvZiBwbHVnaW5zIHRvIGluaXRpYWxpemUuIExlYXZlIHRoaXMgb3V0IHRvIGluaXRpYWxpemUgZXZlcnl0aGluZy5cclxuICAgKi9cclxuICByZWZsb3c6IGZ1bmN0aW9uKGVsZW0sIHBsdWdpbnMpIHtcclxuXHJcbiAgICAvLyBJZiBwbHVnaW5zIGlzIHVuZGVmaW5lZCwganVzdCBncmFiIGV2ZXJ5dGhpbmdcclxuICAgIGlmICh0eXBlb2YgcGx1Z2lucyA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcGx1Z2lucyA9IE9iamVjdC5rZXlzKHRoaXMuX3BsdWdpbnMpO1xyXG4gICAgfVxyXG4gICAgLy8gSWYgcGx1Z2lucyBpcyBhIHN0cmluZywgY29udmVydCBpdCB0byBhbiBhcnJheSB3aXRoIG9uZSBpdGVtXHJcbiAgICBlbHNlIGlmICh0eXBlb2YgcGx1Z2lucyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgcGx1Z2lucyA9IFtwbHVnaW5zXTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBlYWNoIHBsdWdpblxyXG4gICAgJC5lYWNoKHBsdWdpbnMsIGZ1bmN0aW9uKGksIG5hbWUpIHtcclxuICAgICAgLy8gR2V0IHRoZSBjdXJyZW50IHBsdWdpblxyXG4gICAgICB2YXIgcGx1Z2luID0gX3RoaXMuX3BsdWdpbnNbbmFtZV07XHJcblxyXG4gICAgICAvLyBMb2NhbGl6ZSB0aGUgc2VhcmNoIHRvIGFsbCBlbGVtZW50cyBpbnNpZGUgZWxlbSwgYXMgd2VsbCBhcyBlbGVtIGl0c2VsZiwgdW5sZXNzIGVsZW0gPT09IGRvY3VtZW50XHJcbiAgICAgIHZhciAkZWxlbSA9ICQoZWxlbSkuZmluZCgnW2RhdGEtJytuYW1lKyddJykuYWRkQmFjaygnW2RhdGEtJytuYW1lKyddJyk7XHJcblxyXG4gICAgICAvLyBGb3IgZWFjaCBwbHVnaW4gZm91bmQsIGluaXRpYWxpemUgaXRcclxuICAgICAgJGVsZW0uZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgJGVsID0gJCh0aGlzKSxcclxuICAgICAgICAgICAgb3B0cyA9IHt9O1xyXG4gICAgICAgIC8vIERvbid0IGRvdWJsZS1kaXAgb24gcGx1Z2luc1xyXG4gICAgICAgIGlmICgkZWwuZGF0YSgnemZQbHVnaW4nKSkge1xyXG4gICAgICAgICAgY29uc29sZS53YXJuKFwiVHJpZWQgdG8gaW5pdGlhbGl6ZSBcIituYW1lK1wiIG9uIGFuIGVsZW1lbnQgdGhhdCBhbHJlYWR5IGhhcyBhIEZvdW5kYXRpb24gcGx1Z2luLlwiKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKCRlbC5hdHRyKCdkYXRhLW9wdGlvbnMnKSl7XHJcbiAgICAgICAgICB2YXIgdGhpbmcgPSAkZWwuYXR0cignZGF0YS1vcHRpb25zJykuc3BsaXQoJzsnKS5mb3JFYWNoKGZ1bmN0aW9uKGUsIGkpe1xyXG4gICAgICAgICAgICB2YXIgb3B0ID0gZS5zcGxpdCgnOicpLm1hcChmdW5jdGlvbihlbCl7IHJldHVybiBlbC50cmltKCk7IH0pO1xyXG4gICAgICAgICAgICBpZihvcHRbMF0pIG9wdHNbb3B0WzBdXSA9IHBhcnNlVmFsdWUob3B0WzFdKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0cnl7XHJcbiAgICAgICAgICAkZWwuZGF0YSgnemZQbHVnaW4nLCBuZXcgcGx1Z2luKCQodGhpcyksIG9wdHMpKTtcclxuICAgICAgICB9Y2F0Y2goZXIpe1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcik7XHJcbiAgICAgICAgfWZpbmFsbHl7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0sXHJcbiAgZ2V0Rm5OYW1lOiBmdW5jdGlvbk5hbWUsXHJcbiAgdHJhbnNpdGlvbmVuZDogZnVuY3Rpb24oJGVsZW0pe1xyXG4gICAgdmFyIHRyYW5zaXRpb25zID0ge1xyXG4gICAgICAndHJhbnNpdGlvbic6ICd0cmFuc2l0aW9uZW5kJyxcclxuICAgICAgJ1dlYmtpdFRyYW5zaXRpb24nOiAnd2Via2l0VHJhbnNpdGlvbkVuZCcsXHJcbiAgICAgICdNb3pUcmFuc2l0aW9uJzogJ3RyYW5zaXRpb25lbmQnLFxyXG4gICAgICAnT1RyYW5zaXRpb24nOiAnb3RyYW5zaXRpb25lbmQnXHJcbiAgICB9O1xyXG4gICAgdmFyIGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgICBlbmQ7XHJcblxyXG4gICAgZm9yICh2YXIgdCBpbiB0cmFuc2l0aW9ucyl7XHJcbiAgICAgIGlmICh0eXBlb2YgZWxlbS5zdHlsZVt0XSAhPT0gJ3VuZGVmaW5lZCcpe1xyXG4gICAgICAgIGVuZCA9IHRyYW5zaXRpb25zW3RdO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBpZihlbmQpe1xyXG4gICAgICByZXR1cm4gZW5kO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIGVuZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgICAkZWxlbS50cmlnZ2VySGFuZGxlcigndHJhbnNpdGlvbmVuZCcsIFskZWxlbV0pO1xyXG4gICAgICB9LCAxKTtcclxuICAgICAgcmV0dXJuICd0cmFuc2l0aW9uZW5kJztcclxuICAgIH1cclxuICB9XHJcbn07XHJcblxyXG5Gb3VuZGF0aW9uLnV0aWwgPSB7XHJcbiAgLyoqXHJcbiAgICogRnVuY3Rpb24gZm9yIGFwcGx5aW5nIGEgZGVib3VuY2UgZWZmZWN0IHRvIGEgZnVuY3Rpb24gY2FsbC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIC0gRnVuY3Rpb24gdG8gYmUgY2FsbGVkIGF0IGVuZCBvZiB0aW1lb3V0LlxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheSAtIFRpbWUgaW4gbXMgdG8gZGVsYXkgdGhlIGNhbGwgb2YgYGZ1bmNgLlxyXG4gICAqIEByZXR1cm5zIGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgdGhyb3R0bGU6IGZ1bmN0aW9uIChmdW5jLCBkZWxheSkge1xyXG4gICAgdmFyIHRpbWVyID0gbnVsbDtcclxuXHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xyXG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMsIGFyZ3MgPSBhcmd1bWVudHM7XHJcblxyXG4gICAgICBpZiAodGltZXIgPT09IG51bGwpIHtcclxuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcclxuICAgICAgICAgIHRpbWVyID0gbnVsbDtcclxuICAgICAgICB9LCBkZWxheSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfVxyXG59O1xyXG5cclxuLy8gVE9ETzogY29uc2lkZXIgbm90IG1ha2luZyB0aGlzIGEgalF1ZXJ5IGZ1bmN0aW9uXHJcbi8vIFRPRE86IG5lZWQgd2F5IHRvIHJlZmxvdyB2cy4gcmUtaW5pdGlhbGl6ZVxyXG4vKipcclxuICogVGhlIEZvdW5kYXRpb24galF1ZXJ5IG1ldGhvZC5cclxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl9IG1ldGhvZCAtIEFuIGFjdGlvbiB0byBwZXJmb3JtIG9uIHRoZSBjdXJyZW50IGpRdWVyeSBvYmplY3QuXHJcbiAqL1xyXG52YXIgZm91bmRhdGlvbiA9IGZ1bmN0aW9uKG1ldGhvZCkge1xyXG4gIHZhciB0eXBlID0gdHlwZW9mIG1ldGhvZCxcclxuICAgICAgJG1ldGEgPSAkKCdtZXRhLmZvdW5kYXRpb24tbXEnKSxcclxuICAgICAgJG5vSlMgPSAkKCcubm8tanMnKTtcclxuXHJcbiAgaWYoISRtZXRhLmxlbmd0aCl7XHJcbiAgICAkKCc8bWV0YSBjbGFzcz1cImZvdW5kYXRpb24tbXFcIj4nKS5hcHBlbmRUbyhkb2N1bWVudC5oZWFkKTtcclxuICB9XHJcbiAgaWYoJG5vSlMubGVuZ3RoKXtcclxuICAgICRub0pTLnJlbW92ZUNsYXNzKCduby1qcycpO1xyXG4gIH1cclxuXHJcbiAgaWYodHlwZSA9PT0gJ3VuZGVmaW5lZCcpey8vbmVlZHMgdG8gaW5pdGlhbGl6ZSB0aGUgRm91bmRhdGlvbiBvYmplY3QsIG9yIGFuIGluZGl2aWR1YWwgcGx1Z2luLlxyXG4gICAgRm91bmRhdGlvbi5NZWRpYVF1ZXJ5Ll9pbml0KCk7XHJcbiAgICBGb3VuZGF0aW9uLnJlZmxvdyh0aGlzKTtcclxuICB9ZWxzZSBpZih0eXBlID09PSAnc3RyaW5nJyl7Ly9hbiBpbmRpdmlkdWFsIG1ldGhvZCB0byBpbnZva2Ugb24gYSBwbHVnaW4gb3IgZ3JvdXAgb2YgcGx1Z2luc1xyXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpOy8vY29sbGVjdCBhbGwgdGhlIGFyZ3VtZW50cywgaWYgbmVjZXNzYXJ5XHJcbiAgICB2YXIgcGx1Z0NsYXNzID0gdGhpcy5kYXRhKCd6ZlBsdWdpbicpOy8vZGV0ZXJtaW5lIHRoZSBjbGFzcyBvZiBwbHVnaW5cclxuXHJcbiAgICBpZihwbHVnQ2xhc3MgIT09IHVuZGVmaW5lZCAmJiBwbHVnQ2xhc3NbbWV0aG9kXSAhPT0gdW5kZWZpbmVkKXsvL21ha2Ugc3VyZSBib3RoIHRoZSBjbGFzcyBhbmQgbWV0aG9kIGV4aXN0XHJcbiAgICAgIGlmKHRoaXMubGVuZ3RoID09PSAxKXsvL2lmIHRoZXJlJ3Mgb25seSBvbmUsIGNhbGwgaXQgZGlyZWN0bHkuXHJcbiAgICAgICAgICBwbHVnQ2xhc3NbbWV0aG9kXS5hcHBseShwbHVnQ2xhc3MsIGFyZ3MpO1xyXG4gICAgICB9ZWxzZXtcclxuICAgICAgICB0aGlzLmVhY2goZnVuY3Rpb24oaSwgZWwpey8vb3RoZXJ3aXNlIGxvb3AgdGhyb3VnaCB0aGUgalF1ZXJ5IGNvbGxlY3Rpb24gYW5kIGludm9rZSB0aGUgbWV0aG9kIG9uIGVhY2hcclxuICAgICAgICAgIHBsdWdDbGFzc1ttZXRob2RdLmFwcGx5KCQoZWwpLmRhdGEoJ3pmUGx1Z2luJyksIGFyZ3MpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9ZWxzZXsvL2Vycm9yIGZvciBubyBjbGFzcyBvciBubyBtZXRob2RcclxuICAgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwiV2UncmUgc29ycnksICdcIiArIG1ldGhvZCArIFwiJyBpcyBub3QgYW4gYXZhaWxhYmxlIG1ldGhvZCBmb3IgXCIgKyAocGx1Z0NsYXNzID8gZnVuY3Rpb25OYW1lKHBsdWdDbGFzcykgOiAndGhpcyBlbGVtZW50JykgKyAnLicpO1xyXG4gICAgfVxyXG4gIH1lbHNley8vZXJyb3IgZm9yIGludmFsaWQgYXJndW1lbnQgdHlwZVxyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgV2UncmUgc29ycnksICR7dHlwZX0gaXMgbm90IGEgdmFsaWQgcGFyYW1ldGVyLiBZb3UgbXVzdCB1c2UgYSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBtZXRob2QgeW91IHdpc2ggdG8gaW52b2tlLmApO1xyXG4gIH1cclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbndpbmRvdy5Gb3VuZGF0aW9uID0gRm91bmRhdGlvbjtcclxuJC5mbi5mb3VuZGF0aW9uID0gZm91bmRhdGlvbjtcclxuXHJcbi8vIFBvbHlmaWxsIGZvciByZXF1ZXN0QW5pbWF0aW9uRnJhbWVcclxuKGZ1bmN0aW9uKCkge1xyXG4gIGlmICghRGF0ZS5ub3cgfHwgIXdpbmRvdy5EYXRlLm5vdylcclxuICAgIHdpbmRvdy5EYXRlLm5vdyA9IERhdGUubm93ID0gZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTsgfTtcclxuXHJcbiAgdmFyIHZlbmRvcnMgPSBbJ3dlYmtpdCcsICdtb3onXTtcclxuICBmb3IgKHZhciBpID0gMDsgaSA8IHZlbmRvcnMubGVuZ3RoICYmICF3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lOyArK2kpIHtcclxuICAgICAgdmFyIHZwID0gdmVuZG9yc1tpXTtcclxuICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2cCsnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XHJcbiAgICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9ICh3aW5kb3dbdnArJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfHwgd2luZG93W3ZwKydDYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXSk7XHJcbiAgfVxyXG4gIGlmICgvaVAoYWR8aG9uZXxvZCkuKk9TIDYvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpXHJcbiAgICB8fCAhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAhd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XHJcbiAgICB2YXIgbGFzdFRpbWUgPSAwO1xyXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdmFyIG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgdmFyIG5leHRUaW1lID0gTWF0aC5tYXgobGFzdFRpbWUgKyAxNiwgbm93KTtcclxuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHsgY2FsbGJhY2sobGFzdFRpbWUgPSBuZXh0VGltZSk7IH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFRpbWUgLSBub3cpO1xyXG4gICAgfTtcclxuICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNsZWFyVGltZW91dDtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogUG9seWZpbGwgZm9yIHBlcmZvcm1hbmNlLm5vdywgcmVxdWlyZWQgYnkgckFGXHJcbiAgICovXHJcbiAgaWYoIXdpbmRvdy5wZXJmb3JtYW5jZSB8fCAhd2luZG93LnBlcmZvcm1hbmNlLm5vdyl7XHJcbiAgICB3aW5kb3cucGVyZm9ybWFuY2UgPSB7XHJcbiAgICAgIHN0YXJ0OiBEYXRlLm5vdygpLFxyXG4gICAgICBub3c6IGZ1bmN0aW9uKCl7IHJldHVybiBEYXRlLm5vdygpIC0gdGhpcy5zdGFydDsgfVxyXG4gICAgfTtcclxuICB9XHJcbn0pKCk7XHJcbmlmICghRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQpIHtcclxuICBGdW5jdGlvbi5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uKG9UaGlzKSB7XHJcbiAgICBpZiAodHlwZW9mIHRoaXMgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgLy8gY2xvc2VzdCB0aGluZyBwb3NzaWJsZSB0byB0aGUgRUNNQVNjcmlwdCA1XHJcbiAgICAgIC8vIGludGVybmFsIElzQ2FsbGFibGUgZnVuY3Rpb25cclxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgLSB3aGF0IGlzIHRyeWluZyB0byBiZSBib3VuZCBpcyBub3QgY2FsbGFibGUnKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgYUFyZ3MgICA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXHJcbiAgICAgICAgZlRvQmluZCA9IHRoaXMsXHJcbiAgICAgICAgZk5PUCAgICA9IGZ1bmN0aW9uKCkge30sXHJcbiAgICAgICAgZkJvdW5kICA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgcmV0dXJuIGZUb0JpbmQuYXBwbHkodGhpcyBpbnN0YW5jZW9mIGZOT1BcclxuICAgICAgICAgICAgICAgICA/IHRoaXNcclxuICAgICAgICAgICAgICAgICA6IG9UaGlzLFxyXG4gICAgICAgICAgICAgICAgIGFBcmdzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICBpZiAodGhpcy5wcm90b3R5cGUpIHtcclxuICAgICAgLy8gbmF0aXZlIGZ1bmN0aW9ucyBkb24ndCBoYXZlIGEgcHJvdG90eXBlXHJcbiAgICAgIGZOT1AucHJvdG90eXBlID0gdGhpcy5wcm90b3R5cGU7XHJcbiAgICB9XHJcbiAgICBmQm91bmQucHJvdG90eXBlID0gbmV3IGZOT1AoKTtcclxuXHJcbiAgICByZXR1cm4gZkJvdW5kO1xyXG4gIH07XHJcbn1cclxuLy8gUG9seWZpbGwgdG8gZ2V0IHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24gaW4gSUU5XHJcbmZ1bmN0aW9uIGZ1bmN0aW9uTmFtZShmbikge1xyXG4gIGlmIChGdW5jdGlvbi5wcm90b3R5cGUubmFtZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgZnVuY05hbWVSZWdleCA9IC9mdW5jdGlvblxccyhbXihdezEsfSlcXCgvO1xyXG4gICAgdmFyIHJlc3VsdHMgPSAoZnVuY05hbWVSZWdleCkuZXhlYygoZm4pLnRvU3RyaW5nKCkpO1xyXG4gICAgcmV0dXJuIChyZXN1bHRzICYmIHJlc3VsdHMubGVuZ3RoID4gMSkgPyByZXN1bHRzWzFdLnRyaW0oKSA6IFwiXCI7XHJcbiAgfVxyXG4gIGVsc2UgaWYgKGZuLnByb3RvdHlwZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gZm4uY29uc3RydWN0b3IubmFtZTtcclxuICB9XHJcbiAgZWxzZSB7XHJcbiAgICByZXR1cm4gZm4ucHJvdG90eXBlLmNvbnN0cnVjdG9yLm5hbWU7XHJcbiAgfVxyXG59XHJcbmZ1bmN0aW9uIHBhcnNlVmFsdWUoc3RyKXtcclxuICBpZiAoJ3RydWUnID09PSBzdHIpIHJldHVybiB0cnVlO1xyXG4gIGVsc2UgaWYgKCdmYWxzZScgPT09IHN0cikgcmV0dXJuIGZhbHNlO1xyXG4gIGVsc2UgaWYgKCFpc05hTihzdHIgKiAxKSkgcmV0dXJuIHBhcnNlRmxvYXQoc3RyKTtcclxuICByZXR1cm4gc3RyO1xyXG59XHJcbi8vIENvbnZlcnQgUGFzY2FsQ2FzZSB0byBrZWJhYi1jYXNlXHJcbi8vIFRoYW5rIHlvdTogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvODk1NTU4MFxyXG5mdW5jdGlvbiBoeXBoZW5hdGUoc3RyKSB7XHJcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEtJDInKS50b0xvd2VyQ2FzZSgpO1xyXG59XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG5Gb3VuZGF0aW9uLkJveCA9IHtcclxuICBJbU5vdFRvdWNoaW5nWW91OiBJbU5vdFRvdWNoaW5nWW91LFxyXG4gIEdldERpbWVuc2lvbnM6IEdldERpbWVuc2lvbnMsXHJcbiAgR2V0T2Zmc2V0czogR2V0T2Zmc2V0c1xyXG59XHJcblxyXG4vKipcclxuICogQ29tcGFyZXMgdGhlIGRpbWVuc2lvbnMgb2YgYW4gZWxlbWVudCB0byBhIGNvbnRhaW5lciBhbmQgZGV0ZXJtaW5lcyBjb2xsaXNpb24gZXZlbnRzIHdpdGggY29udGFpbmVyLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIHRlc3QgZm9yIGNvbGxpc2lvbnMuXHJcbiAqIEBwYXJhbSB7alF1ZXJ5fSBwYXJlbnQgLSBqUXVlcnkgb2JqZWN0IHRvIHVzZSBhcyBib3VuZGluZyBjb250YWluZXIuXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gbHJPbmx5IC0gc2V0IHRvIHRydWUgdG8gY2hlY2sgbGVmdCBhbmQgcmlnaHQgdmFsdWVzIG9ubHkuXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gdGJPbmx5IC0gc2V0IHRvIHRydWUgdG8gY2hlY2sgdG9wIGFuZCBib3R0b20gdmFsdWVzIG9ubHkuXHJcbiAqIEBkZWZhdWx0IGlmIG5vIHBhcmVudCBvYmplY3QgcGFzc2VkLCBkZXRlY3RzIGNvbGxpc2lvbnMgd2l0aCBgd2luZG93YC5cclxuICogQHJldHVybnMge0Jvb2xlYW59IC0gdHJ1ZSBpZiBjb2xsaXNpb24gZnJlZSwgZmFsc2UgaWYgYSBjb2xsaXNpb24gaW4gYW55IGRpcmVjdGlvbi5cclxuICovXHJcbmZ1bmN0aW9uIEltTm90VG91Y2hpbmdZb3UoZWxlbWVudCwgcGFyZW50LCBsck9ubHksIHRiT25seSkge1xyXG4gIHZhciBlbGVEaW1zID0gR2V0RGltZW5zaW9ucyhlbGVtZW50KSxcclxuICAgICAgdG9wLCBib3R0b20sIGxlZnQsIHJpZ2h0O1xyXG5cclxuICBpZiAocGFyZW50KSB7XHJcbiAgICB2YXIgcGFyRGltcyA9IEdldERpbWVuc2lvbnMocGFyZW50KTtcclxuXHJcbiAgICBib3R0b20gPSAoZWxlRGltcy5vZmZzZXQudG9wICsgZWxlRGltcy5oZWlnaHQgPD0gcGFyRGltcy5oZWlnaHQgKyBwYXJEaW1zLm9mZnNldC50b3ApO1xyXG4gICAgdG9wICAgID0gKGVsZURpbXMub2Zmc2V0LnRvcCA+PSBwYXJEaW1zLm9mZnNldC50b3ApO1xyXG4gICAgbGVmdCAgID0gKGVsZURpbXMub2Zmc2V0LmxlZnQgPj0gcGFyRGltcy5vZmZzZXQubGVmdCk7XHJcbiAgICByaWdodCAgPSAoZWxlRGltcy5vZmZzZXQubGVmdCArIGVsZURpbXMud2lkdGggPD0gcGFyRGltcy53aWR0aCArIHBhckRpbXMub2Zmc2V0LmxlZnQpO1xyXG4gIH1cclxuICBlbHNlIHtcclxuICAgIGJvdHRvbSA9IChlbGVEaW1zLm9mZnNldC50b3AgKyBlbGVEaW1zLmhlaWdodCA8PSBlbGVEaW1zLndpbmRvd0RpbXMuaGVpZ2h0ICsgZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC50b3ApO1xyXG4gICAgdG9wICAgID0gKGVsZURpbXMub2Zmc2V0LnRvcCA+PSBlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LnRvcCk7XHJcbiAgICBsZWZ0ICAgPSAoZWxlRGltcy5vZmZzZXQubGVmdCA+PSBlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LmxlZnQpO1xyXG4gICAgcmlnaHQgID0gKGVsZURpbXMub2Zmc2V0LmxlZnQgKyBlbGVEaW1zLndpZHRoIDw9IGVsZURpbXMud2luZG93RGltcy53aWR0aCk7XHJcbiAgfVxyXG5cclxuICB2YXIgYWxsRGlycyA9IFtib3R0b20sIHRvcCwgbGVmdCwgcmlnaHRdO1xyXG5cclxuICBpZiAobHJPbmx5KSB7XHJcbiAgICByZXR1cm4gbGVmdCA9PT0gcmlnaHQgPT09IHRydWU7XHJcbiAgfVxyXG5cclxuICBpZiAodGJPbmx5KSB7XHJcbiAgICByZXR1cm4gdG9wID09PSBib3R0b20gPT09IHRydWU7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gYWxsRGlycy5pbmRleE9mKGZhbHNlKSA9PT0gLTE7XHJcbn07XHJcblxyXG4vKipcclxuICogVXNlcyBuYXRpdmUgbWV0aG9kcyB0byByZXR1cm4gYW4gb2JqZWN0IG9mIGRpbWVuc2lvbiB2YWx1ZXMuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge2pRdWVyeSB8fCBIVE1MfSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCBvciBET00gZWxlbWVudCBmb3Igd2hpY2ggdG8gZ2V0IHRoZSBkaW1lbnNpb25zLiBDYW4gYmUgYW55IGVsZW1lbnQgb3RoZXIgdGhhdCBkb2N1bWVudCBvciB3aW5kb3cuXHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IC0gbmVzdGVkIG9iamVjdCBvZiBpbnRlZ2VyIHBpeGVsIHZhbHVlc1xyXG4gKiBUT0RPIC0gaWYgZWxlbWVudCBpcyB3aW5kb3csIHJldHVybiBvbmx5IHRob3NlIHZhbHVlcy5cclxuICovXHJcbmZ1bmN0aW9uIEdldERpbWVuc2lvbnMoZWxlbSwgdGVzdCl7XHJcbiAgZWxlbSA9IGVsZW0ubGVuZ3RoID8gZWxlbVswXSA6IGVsZW07XHJcblxyXG4gIGlmIChlbGVtID09PSB3aW5kb3cgfHwgZWxlbSA9PT0gZG9jdW1lbnQpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihcIkknbSBzb3JyeSwgRGF2ZS4gSSdtIGFmcmFpZCBJIGNhbid0IGRvIHRoYXQuXCIpO1xyXG4gIH1cclxuXHJcbiAgdmFyIHJlY3QgPSBlbGVtLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxyXG4gICAgICBwYXJSZWN0ID0gZWxlbS5wYXJlbnROb2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxyXG4gICAgICB3aW5SZWN0ID0gZG9jdW1lbnQuYm9keS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcclxuICAgICAgd2luWSA9IHdpbmRvdy5wYWdlWU9mZnNldCxcclxuICAgICAgd2luWCA9IHdpbmRvdy5wYWdlWE9mZnNldDtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHdpZHRoOiByZWN0LndpZHRoLFxyXG4gICAgaGVpZ2h0OiByZWN0LmhlaWdodCxcclxuICAgIG9mZnNldDoge1xyXG4gICAgICB0b3A6IHJlY3QudG9wICsgd2luWSxcclxuICAgICAgbGVmdDogcmVjdC5sZWZ0ICsgd2luWFxyXG4gICAgfSxcclxuICAgIHBhcmVudERpbXM6IHtcclxuICAgICAgd2lkdGg6IHBhclJlY3Qud2lkdGgsXHJcbiAgICAgIGhlaWdodDogcGFyUmVjdC5oZWlnaHQsXHJcbiAgICAgIG9mZnNldDoge1xyXG4gICAgICAgIHRvcDogcGFyUmVjdC50b3AgKyB3aW5ZLFxyXG4gICAgICAgIGxlZnQ6IHBhclJlY3QubGVmdCArIHdpblhcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIHdpbmRvd0RpbXM6IHtcclxuICAgICAgd2lkdGg6IHdpblJlY3Qud2lkdGgsXHJcbiAgICAgIGhlaWdodDogd2luUmVjdC5oZWlnaHQsXHJcbiAgICAgIG9mZnNldDoge1xyXG4gICAgICAgIHRvcDogd2luWSxcclxuICAgICAgICBsZWZ0OiB3aW5YXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGFuIG9iamVjdCBvZiB0b3AgYW5kIGxlZnQgaW50ZWdlciBwaXhlbCB2YWx1ZXMgZm9yIGR5bmFtaWNhbGx5IHJlbmRlcmVkIGVsZW1lbnRzLFxyXG4gKiBzdWNoIGFzOiBUb29sdGlwLCBSZXZlYWwsIGFuZCBEcm9wZG93blxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IGZvciB0aGUgZWxlbWVudCBiZWluZyBwb3NpdGlvbmVkLlxyXG4gKiBAcGFyYW0ge2pRdWVyeX0gYW5jaG9yIC0galF1ZXJ5IG9iamVjdCBmb3IgdGhlIGVsZW1lbnQncyBhbmNob3IgcG9pbnQuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBwb3NpdGlvbiAtIGEgc3RyaW5nIHJlbGF0aW5nIHRvIHRoZSBkZXNpcmVkIHBvc2l0aW9uIG9mIHRoZSBlbGVtZW50LCByZWxhdGl2ZSB0byBpdCdzIGFuY2hvclxyXG4gKiBAcGFyYW0ge051bWJlcn0gdk9mZnNldCAtIGludGVnZXIgcGl4ZWwgdmFsdWUgb2YgZGVzaXJlZCB2ZXJ0aWNhbCBzZXBhcmF0aW9uIGJldHdlZW4gYW5jaG9yIGFuZCBlbGVtZW50LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gaE9mZnNldCAtIGludGVnZXIgcGl4ZWwgdmFsdWUgb2YgZGVzaXJlZCBob3Jpem9udGFsIHNlcGFyYXRpb24gYmV0d2VlbiBhbmNob3IgYW5kIGVsZW1lbnQuXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNPdmVyZmxvdyAtIGlmIGEgY29sbGlzaW9uIGV2ZW50IGlzIGRldGVjdGVkLCBzZXRzIHRvIHRydWUgdG8gZGVmYXVsdCB0aGUgZWxlbWVudCB0byBmdWxsIHdpZHRoIC0gYW55IGRlc2lyZWQgb2Zmc2V0LlxyXG4gKiBUT0RPIGFsdGVyL3Jld3JpdGUgdG8gd29yayB3aXRoIGBlbWAgdmFsdWVzIGFzIHdlbGwvaW5zdGVhZCBvZiBwaXhlbHNcclxuICovXHJcbmZ1bmN0aW9uIEdldE9mZnNldHMoZWxlbWVudCwgYW5jaG9yLCBwb3NpdGlvbiwgdk9mZnNldCwgaE9mZnNldCwgaXNPdmVyZmxvdykge1xyXG4gIHZhciAkZWxlRGltcyA9IEdldERpbWVuc2lvbnMoZWxlbWVudCksXHJcbiAgICAgICRhbmNob3JEaW1zID0gYW5jaG9yID8gR2V0RGltZW5zaW9ucyhhbmNob3IpIDogbnVsbDtcclxuXHJcbiAgc3dpdGNoIChwb3NpdGlvbikge1xyXG4gICAgY2FzZSAndG9wJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAoRm91bmRhdGlvbi5ydGwoKSA/ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0IC0gJGVsZURpbXMud2lkdGggKyAkYW5jaG9yRGltcy53aWR0aCA6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0KSxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3AgLSAoJGVsZURpbXMuaGVpZ2h0ICsgdk9mZnNldClcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2xlZnQnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0IC0gKCRlbGVEaW1zLndpZHRoICsgaE9mZnNldCksXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdyaWdodCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgKyAkYW5jaG9yRGltcy53aWR0aCArIGhPZmZzZXQsXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdjZW50ZXIgdG9wJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAoJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgKyAoJGFuY2hvckRpbXMud2lkdGggLyAyKSkgLSAoJGVsZURpbXMud2lkdGggLyAyKSxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3AgLSAoJGVsZURpbXMuaGVpZ2h0ICsgdk9mZnNldClcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2NlbnRlciBib3R0b20nOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6IGlzT3ZlcmZsb3cgPyBoT2Zmc2V0IDogKCgkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArICgkYW5jaG9yRGltcy53aWR0aCAvIDIpKSAtICgkZWxlRGltcy53aWR0aCAvIDIpKSxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3AgKyAkYW5jaG9yRGltcy5oZWlnaHQgKyB2T2Zmc2V0XHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdjZW50ZXIgbGVmdCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgLSAoJGVsZURpbXMud2lkdGggKyBoT2Zmc2V0KSxcclxuICAgICAgICB0b3A6ICgkYW5jaG9yRGltcy5vZmZzZXQudG9wICsgKCRhbmNob3JEaW1zLmhlaWdodCAvIDIpKSAtICgkZWxlRGltcy5oZWlnaHQgLyAyKVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnY2VudGVyIHJpZ2h0JzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArICRhbmNob3JEaW1zLndpZHRoICsgaE9mZnNldCArIDEsXHJcbiAgICAgICAgdG9wOiAoJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICgkYW5jaG9yRGltcy5oZWlnaHQgLyAyKSkgLSAoJGVsZURpbXMuaGVpZ2h0IC8gMilcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2NlbnRlcic6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogKCRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LmxlZnQgKyAoJGVsZURpbXMud2luZG93RGltcy53aWR0aCAvIDIpKSAtICgkZWxlRGltcy53aWR0aCAvIDIpLFxyXG4gICAgICAgIHRvcDogKCRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LnRvcCArICgkZWxlRGltcy53aW5kb3dEaW1zLmhlaWdodCAvIDIpKSAtICgkZWxlRGltcy5oZWlnaHQgLyAyKVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAncmV2ZWFsJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAoJGVsZURpbXMud2luZG93RGltcy53aWR0aCAtICRlbGVEaW1zLndpZHRoKSAvIDIsXHJcbiAgICAgICAgdG9wOiAkZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC50b3AgKyB2T2Zmc2V0XHJcbiAgICAgIH1cclxuICAgIGNhc2UgJ3JldmVhbCBmdWxsJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAkZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC5sZWZ0LFxyXG4gICAgICAgIHRvcDogJGVsZURpbXMud2luZG93RGltcy5vZmZzZXQudG9wXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdsZWZ0IGJvdHRvbSc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQsXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wICsgJGFuY2hvckRpbXMuaGVpZ2h0ICsgdk9mZnNldFxyXG4gICAgICB9O1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ3JpZ2h0IGJvdHRvbSc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgKyAkYW5jaG9yRGltcy53aWR0aCArIGhPZmZzZXQgLSAkZWxlRGltcy53aWR0aCxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3AgKyAkYW5jaG9yRGltcy5oZWlnaHQgKyB2T2Zmc2V0XHJcbiAgICAgIH07XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAoRm91bmRhdGlvbi5ydGwoKSA/ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0IC0gJGVsZURpbXMud2lkdGggKyAkYW5jaG9yRGltcy53aWR0aCA6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgaE9mZnNldCksXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wICsgJGFuY2hvckRpbXMuaGVpZ2h0ICsgdk9mZnNldFxyXG4gICAgICB9XHJcbiAgfVxyXG59XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiAqIFRoaXMgdXRpbCB3YXMgY3JlYXRlZCBieSBNYXJpdXMgT2xiZXJ0eiAqXHJcbiAqIFBsZWFzZSB0aGFuayBNYXJpdXMgb24gR2l0SHViIC9vd2xiZXJ0eiAqXHJcbiAqIG9yIHRoZSB3ZWIgaHR0cDovL3d3dy5tYXJpdXNvbGJlcnR6LmRlLyAqXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXHJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4ndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuY29uc3Qga2V5Q29kZXMgPSB7XHJcbiAgOTogJ1RBQicsXHJcbiAgMTM6ICdFTlRFUicsXHJcbiAgMjc6ICdFU0NBUEUnLFxyXG4gIDMyOiAnU1BBQ0UnLFxyXG4gIDM3OiAnQVJST1dfTEVGVCcsXHJcbiAgMzg6ICdBUlJPV19VUCcsXHJcbiAgMzk6ICdBUlJPV19SSUdIVCcsXHJcbiAgNDA6ICdBUlJPV19ET1dOJ1xyXG59XHJcblxyXG52YXIgY29tbWFuZHMgPSB7fVxyXG5cclxudmFyIEtleWJvYXJkID0ge1xyXG4gIGtleXM6IGdldEtleUNvZGVzKGtleUNvZGVzKSxcclxuXHJcbiAgLyoqXHJcbiAgICogUGFyc2VzIHRoZSAoa2V5Ym9hcmQpIGV2ZW50IGFuZCByZXR1cm5zIGEgU3RyaW5nIHRoYXQgcmVwcmVzZW50cyBpdHMga2V5XHJcbiAgICogQ2FuIGJlIHVzZWQgbGlrZSBGb3VuZGF0aW9uLnBhcnNlS2V5KGV2ZW50KSA9PT0gRm91bmRhdGlvbi5rZXlzLlNQQUNFXHJcbiAgICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSB0aGUgZXZlbnQgZ2VuZXJhdGVkIGJ5IHRoZSBldmVudCBoYW5kbGVyXHJcbiAgICogQHJldHVybiBTdHJpbmcga2V5IC0gU3RyaW5nIHRoYXQgcmVwcmVzZW50cyB0aGUga2V5IHByZXNzZWRcclxuICAgKi9cclxuICBwYXJzZUtleShldmVudCkge1xyXG4gICAgdmFyIGtleSA9IGtleUNvZGVzW2V2ZW50LndoaWNoIHx8IGV2ZW50LmtleUNvZGVdIHx8IFN0cmluZy5mcm9tQ2hhckNvZGUoZXZlbnQud2hpY2gpLnRvVXBwZXJDYXNlKCk7XHJcblxyXG4gICAgLy8gUmVtb3ZlIHVuLXByaW50YWJsZSBjaGFyYWN0ZXJzLCBlLmcuIGZvciBgZnJvbUNoYXJDb2RlYCBjYWxscyBmb3IgQ1RSTCBvbmx5IGV2ZW50c1xyXG4gICAga2V5ID0ga2V5LnJlcGxhY2UoL1xcVysvLCAnJyk7XHJcblxyXG4gICAgaWYgKGV2ZW50LnNoaWZ0S2V5KSBrZXkgPSBgU0hJRlRfJHtrZXl9YDtcclxuICAgIGlmIChldmVudC5jdHJsS2V5KSBrZXkgPSBgQ1RSTF8ke2tleX1gO1xyXG4gICAgaWYgKGV2ZW50LmFsdEtleSkga2V5ID0gYEFMVF8ke2tleX1gO1xyXG5cclxuICAgIC8vIFJlbW92ZSB0cmFpbGluZyB1bmRlcnNjb3JlLCBpbiBjYXNlIG9ubHkgbW9kaWZpZXJzIHdlcmUgdXNlZCAoZS5nLiBvbmx5IGBDVFJMX0FMVGApXHJcbiAgICBrZXkgPSBrZXkucmVwbGFjZSgvXyQvLCAnJyk7XHJcblxyXG4gICAgcmV0dXJuIGtleTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGVzIHRoZSBnaXZlbiAoa2V5Ym9hcmQpIGV2ZW50XHJcbiAgICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSB0aGUgZXZlbnQgZ2VuZXJhdGVkIGJ5IHRoZSBldmVudCBoYW5kbGVyXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbXBvbmVudCAtIEZvdW5kYXRpb24gY29tcG9uZW50J3MgbmFtZSwgZS5nLiBTbGlkZXIgb3IgUmV2ZWFsXHJcbiAgICogQHBhcmFtIHtPYmplY3RzfSBmdW5jdGlvbnMgLSBjb2xsZWN0aW9uIG9mIGZ1bmN0aW9ucyB0aGF0IGFyZSB0byBiZSBleGVjdXRlZFxyXG4gICAqL1xyXG4gIGhhbmRsZUtleShldmVudCwgY29tcG9uZW50LCBmdW5jdGlvbnMpIHtcclxuICAgIHZhciBjb21tYW5kTGlzdCA9IGNvbW1hbmRzW2NvbXBvbmVudF0sXHJcbiAgICAgIGtleUNvZGUgPSB0aGlzLnBhcnNlS2V5KGV2ZW50KSxcclxuICAgICAgY21kcyxcclxuICAgICAgY29tbWFuZCxcclxuICAgICAgZm47XHJcblxyXG4gICAgaWYgKCFjb21tYW5kTGlzdCkgcmV0dXJuIGNvbnNvbGUud2FybignQ29tcG9uZW50IG5vdCBkZWZpbmVkIScpO1xyXG5cclxuICAgIGlmICh0eXBlb2YgY29tbWFuZExpc3QubHRyID09PSAndW5kZWZpbmVkJykgeyAvLyB0aGlzIGNvbXBvbmVudCBkb2VzIG5vdCBkaWZmZXJlbnRpYXRlIGJldHdlZW4gbHRyIGFuZCBydGxcclxuICAgICAgICBjbWRzID0gY29tbWFuZExpc3Q7IC8vIHVzZSBwbGFpbiBsaXN0XHJcbiAgICB9IGVsc2UgeyAvLyBtZXJnZSBsdHIgYW5kIHJ0bDogaWYgZG9jdW1lbnQgaXMgcnRsLCBydGwgb3ZlcndyaXRlcyBsdHIgYW5kIHZpY2UgdmVyc2FcclxuICAgICAgICBpZiAoRm91bmRhdGlvbi5ydGwoKSkgY21kcyA9ICQuZXh0ZW5kKHt9LCBjb21tYW5kTGlzdC5sdHIsIGNvbW1hbmRMaXN0LnJ0bCk7XHJcblxyXG4gICAgICAgIGVsc2UgY21kcyA9ICQuZXh0ZW5kKHt9LCBjb21tYW5kTGlzdC5ydGwsIGNvbW1hbmRMaXN0Lmx0cik7XHJcbiAgICB9XHJcbiAgICBjb21tYW5kID0gY21kc1trZXlDb2RlXTtcclxuXHJcbiAgICBmbiA9IGZ1bmN0aW9uc1tjb21tYW5kXTtcclxuICAgIGlmIChmbiAmJiB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpIHsgLy8gZXhlY3V0ZSBmdW5jdGlvbiAgaWYgZXhpc3RzXHJcbiAgICAgIHZhciByZXR1cm5WYWx1ZSA9IGZuLmFwcGx5KCk7XHJcbiAgICAgIGlmIChmdW5jdGlvbnMuaGFuZGxlZCB8fCB0eXBlb2YgZnVuY3Rpb25zLmhhbmRsZWQgPT09ICdmdW5jdGlvbicpIHsgLy8gZXhlY3V0ZSBmdW5jdGlvbiB3aGVuIGV2ZW50IHdhcyBoYW5kbGVkXHJcbiAgICAgICAgICBmdW5jdGlvbnMuaGFuZGxlZChyZXR1cm5WYWx1ZSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmIChmdW5jdGlvbnMudW5oYW5kbGVkIHx8IHR5cGVvZiBmdW5jdGlvbnMudW5oYW5kbGVkID09PSAnZnVuY3Rpb24nKSB7IC8vIGV4ZWN1dGUgZnVuY3Rpb24gd2hlbiBldmVudCB3YXMgbm90IGhhbmRsZWRcclxuICAgICAgICAgIGZ1bmN0aW9ucy51bmhhbmRsZWQoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbmRzIGFsbCBmb2N1c2FibGUgZWxlbWVudHMgd2l0aGluIHRoZSBnaXZlbiBgJGVsZW1lbnRgXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBzZWFyY2ggd2l0aGluXHJcbiAgICogQHJldHVybiB7alF1ZXJ5fSAkZm9jdXNhYmxlIC0gYWxsIGZvY3VzYWJsZSBlbGVtZW50cyB3aXRoaW4gYCRlbGVtZW50YFxyXG4gICAqL1xyXG4gIGZpbmRGb2N1c2FibGUoJGVsZW1lbnQpIHtcclxuICAgIGlmKCEkZWxlbWVudCkge3JldHVybiBmYWxzZTsgfVxyXG4gICAgcmV0dXJuICRlbGVtZW50LmZpbmQoJ2FbaHJlZl0sIGFyZWFbaHJlZl0sIGlucHV0Om5vdChbZGlzYWJsZWRdKSwgc2VsZWN0Om5vdChbZGlzYWJsZWRdKSwgdGV4dGFyZWE6bm90KFtkaXNhYmxlZF0pLCBidXR0b246bm90KFtkaXNhYmxlZF0pLCBpZnJhbWUsIG9iamVjdCwgZW1iZWQsICpbdGFiaW5kZXhdLCAqW2NvbnRlbnRlZGl0YWJsZV0nKS5maWx0ZXIoZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmICghJCh0aGlzKS5pcygnOnZpc2libGUnKSB8fCAkKHRoaXMpLmF0dHIoJ3RhYmluZGV4JykgPCAwKSB7IHJldHVybiBmYWxzZTsgfSAvL29ubHkgaGF2ZSB2aXNpYmxlIGVsZW1lbnRzIGFuZCB0aG9zZSB0aGF0IGhhdmUgYSB0YWJpbmRleCBncmVhdGVyIG9yIGVxdWFsIDBcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm5zIHRoZSBjb21wb25lbnQgbmFtZSBuYW1lXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGNvbXBvbmVudCAtIEZvdW5kYXRpb24gY29tcG9uZW50LCBlLmcuIFNsaWRlciBvciBSZXZlYWxcclxuICAgKiBAcmV0dXJuIFN0cmluZyBjb21wb25lbnROYW1lXHJcbiAgICovXHJcblxyXG4gIHJlZ2lzdGVyKGNvbXBvbmVudE5hbWUsIGNtZHMpIHtcclxuICAgIGNvbW1hbmRzW2NvbXBvbmVudE5hbWVdID0gY21kcztcclxuICB9LCAgXHJcblxyXG4gIC8qKlxyXG4gICAqIFRyYXBzIHRoZSBmb2N1cyBpbiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgKiBAcGFyYW0gIHtqUXVlcnl9ICRlbGVtZW50ICBqUXVlcnkgb2JqZWN0IHRvIHRyYXAgdGhlIGZvdWNzIGludG8uXHJcbiAgICovXHJcbiAgdHJhcEZvY3VzKCRlbGVtZW50KSB7XHJcbiAgICB2YXIgJGZvY3VzYWJsZSA9IEZvdW5kYXRpb24uS2V5Ym9hcmQuZmluZEZvY3VzYWJsZSgkZWxlbWVudCksXHJcbiAgICAgICAgJGZpcnN0Rm9jdXNhYmxlID0gJGZvY3VzYWJsZS5lcSgwKSxcclxuICAgICAgICAkbGFzdEZvY3VzYWJsZSA9ICRmb2N1c2FibGUuZXEoLTEpO1xyXG5cclxuICAgICRlbGVtZW50Lm9uKCdrZXlkb3duLnpmLnRyYXBmb2N1cycsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICAgIGlmIChldmVudC50YXJnZXQgPT09ICRsYXN0Rm9jdXNhYmxlWzBdICYmIEZvdW5kYXRpb24uS2V5Ym9hcmQucGFyc2VLZXkoZXZlbnQpID09PSAnVEFCJykge1xyXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgJGZpcnN0Rm9jdXNhYmxlLmZvY3VzKCk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSBpZiAoZXZlbnQudGFyZ2V0ID09PSAkZmlyc3RGb2N1c2FibGVbMF0gJiYgRm91bmRhdGlvbi5LZXlib2FyZC5wYXJzZUtleShldmVudCkgPT09ICdTSElGVF9UQUInKSB7XHJcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAkbGFzdEZvY3VzYWJsZS5mb2N1cygpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIFJlbGVhc2VzIHRoZSB0cmFwcGVkIGZvY3VzIGZyb20gdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICogQHBhcmFtICB7alF1ZXJ5fSAkZWxlbWVudCAgalF1ZXJ5IG9iamVjdCB0byByZWxlYXNlIHRoZSBmb2N1cyBmb3IuXHJcbiAgICovXHJcbiAgcmVsZWFzZUZvY3VzKCRlbGVtZW50KSB7XHJcbiAgICAkZWxlbWVudC5vZmYoJ2tleWRvd24uemYudHJhcGZvY3VzJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKlxyXG4gKiBDb25zdGFudHMgZm9yIGVhc2llciBjb21wYXJpbmcuXHJcbiAqIENhbiBiZSB1c2VkIGxpa2UgRm91bmRhdGlvbi5wYXJzZUtleShldmVudCkgPT09IEZvdW5kYXRpb24ua2V5cy5TUEFDRVxyXG4gKi9cclxuZnVuY3Rpb24gZ2V0S2V5Q29kZXMoa2NzKSB7XHJcbiAgdmFyIGsgPSB7fTtcclxuICBmb3IgKHZhciBrYyBpbiBrY3MpIGtba2NzW2tjXV0gPSBrY3Nba2NdO1xyXG4gIHJldHVybiBrO1xyXG59XHJcblxyXG5Gb3VuZGF0aW9uLktleWJvYXJkID0gS2V5Ym9hcmQ7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vLyBEZWZhdWx0IHNldCBvZiBtZWRpYSBxdWVyaWVzXHJcbmNvbnN0IGRlZmF1bHRRdWVyaWVzID0ge1xyXG4gICdkZWZhdWx0JyA6ICdvbmx5IHNjcmVlbicsXHJcbiAgbGFuZHNjYXBlIDogJ29ubHkgc2NyZWVuIGFuZCAob3JpZW50YXRpb246IGxhbmRzY2FwZSknLFxyXG4gIHBvcnRyYWl0IDogJ29ubHkgc2NyZWVuIGFuZCAob3JpZW50YXRpb246IHBvcnRyYWl0KScsXHJcbiAgcmV0aW5hIDogJ29ubHkgc2NyZWVuIGFuZCAoLXdlYmtpdC1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAyKSwnICtcclxuICAgICdvbmx5IHNjcmVlbiBhbmQgKG1pbi0tbW96LWRldmljZS1waXhlbC1yYXRpbzogMiksJyArXHJcbiAgICAnb25seSBzY3JlZW4gYW5kICgtby1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAyLzEpLCcgK1xyXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAobWluLWRldmljZS1waXhlbC1yYXRpbzogMiksJyArXHJcbiAgICAnb25seSBzY3JlZW4gYW5kIChtaW4tcmVzb2x1dGlvbjogMTkyZHBpKSwnICtcclxuICAgICdvbmx5IHNjcmVlbiBhbmQgKG1pbi1yZXNvbHV0aW9uOiAyZHBweCknXHJcbn07XHJcblxyXG52YXIgTWVkaWFRdWVyeSA9IHtcclxuICBxdWVyaWVzOiBbXSxcclxuXHJcbiAgY3VycmVudDogJycsXHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBtZWRpYSBxdWVyeSBoZWxwZXIsIGJ5IGV4dHJhY3RpbmcgdGhlIGJyZWFrcG9pbnQgbGlzdCBmcm9tIHRoZSBDU1MgYW5kIGFjdGl2YXRpbmcgdGhlIGJyZWFrcG9pbnQgd2F0Y2hlci5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgdmFyIGV4dHJhY3RlZFN0eWxlcyA9ICQoJy5mb3VuZGF0aW9uLW1xJykuY3NzKCdmb250LWZhbWlseScpO1xyXG4gICAgdmFyIG5hbWVkUXVlcmllcztcclxuXHJcbiAgICBuYW1lZFF1ZXJpZXMgPSBwYXJzZVN0eWxlVG9PYmplY3QoZXh0cmFjdGVkU3R5bGVzKTtcclxuXHJcbiAgICBmb3IgKHZhciBrZXkgaW4gbmFtZWRRdWVyaWVzKSB7XHJcbiAgICAgIGlmKG5hbWVkUXVlcmllcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgICAgc2VsZi5xdWVyaWVzLnB1c2goe1xyXG4gICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgdmFsdWU6IGBvbmx5IHNjcmVlbiBhbmQgKG1pbi13aWR0aDogJHtuYW1lZFF1ZXJpZXNba2V5XX0pYFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5jdXJyZW50ID0gdGhpcy5fZ2V0Q3VycmVudFNpemUoKTtcclxuXHJcbiAgICB0aGlzLl93YXRjaGVyKCk7XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIGlmIHRoZSBzY3JlZW4gaXMgYXQgbGVhc3QgYXMgd2lkZSBhcyBhIGJyZWFrcG9pbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNpemUgLSBOYW1lIG9mIHRoZSBicmVha3BvaW50IHRvIGNoZWNrLlxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBgdHJ1ZWAgaWYgdGhlIGJyZWFrcG9pbnQgbWF0Y2hlcywgYGZhbHNlYCBpZiBpdCdzIHNtYWxsZXIuXHJcbiAgICovXHJcbiAgYXRMZWFzdChzaXplKSB7XHJcbiAgICB2YXIgcXVlcnkgPSB0aGlzLmdldChzaXplKTtcclxuXHJcbiAgICBpZiAocXVlcnkpIHtcclxuICAgICAgcmV0dXJuIHdpbmRvdy5tYXRjaE1lZGlhKHF1ZXJ5KS5tYXRjaGVzO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgaWYgdGhlIHNjcmVlbiBtYXRjaGVzIHRvIGEgYnJlYWtwb2ludC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2l6ZSAtIE5hbWUgb2YgdGhlIGJyZWFrcG9pbnQgdG8gY2hlY2ssIGVpdGhlciAnc21hbGwgb25seScgb3IgJ3NtYWxsJy4gT21pdHRpbmcgJ29ubHknIGZhbGxzIGJhY2sgdG8gdXNpbmcgYXRMZWFzdCgpIG1ldGhvZC5cclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gYHRydWVgIGlmIHRoZSBicmVha3BvaW50IG1hdGNoZXMsIGBmYWxzZWAgaWYgaXQgZG9lcyBub3QuXHJcbiAgICovXHJcbiAgaXMoc2l6ZSkge1xyXG4gICAgc2l6ZSA9IHNpemUudHJpbSgpLnNwbGl0KCcgJyk7XHJcbiAgICBpZihzaXplLmxlbmd0aCA+IDEgJiYgc2l6ZVsxXSA9PT0gJ29ubHknKSB7XHJcbiAgICAgIGlmKHNpemVbMF0gPT09IHRoaXMuX2dldEN1cnJlbnRTaXplKCkpIHJldHVybiB0cnVlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIHRoaXMuYXRMZWFzdChzaXplWzBdKTtcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBHZXRzIHRoZSBtZWRpYSBxdWVyeSBvZiBhIGJyZWFrcG9pbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNpemUgLSBOYW1lIG9mIHRoZSBicmVha3BvaW50IHRvIGdldC5cclxuICAgKiBAcmV0dXJucyB7U3RyaW5nfG51bGx9IC0gVGhlIG1lZGlhIHF1ZXJ5IG9mIHRoZSBicmVha3BvaW50LCBvciBgbnVsbGAgaWYgdGhlIGJyZWFrcG9pbnQgZG9lc24ndCBleGlzdC5cclxuICAgKi9cclxuICBnZXQoc2l6ZSkge1xyXG4gICAgZm9yICh2YXIgaSBpbiB0aGlzLnF1ZXJpZXMpIHtcclxuICAgICAgaWYodGhpcy5xdWVyaWVzLmhhc093blByb3BlcnR5KGkpKSB7XHJcbiAgICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2ldO1xyXG4gICAgICAgIGlmIChzaXplID09PSBxdWVyeS5uYW1lKSByZXR1cm4gcXVlcnkudmFsdWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBHZXRzIHRoZSBjdXJyZW50IGJyZWFrcG9pbnQgbmFtZSBieSB0ZXN0aW5nIGV2ZXJ5IGJyZWFrcG9pbnQgYW5kIHJldHVybmluZyB0aGUgbGFzdCBvbmUgdG8gbWF0Y2ggKHRoZSBiaWdnZXN0IG9uZSkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBOYW1lIG9mIHRoZSBjdXJyZW50IGJyZWFrcG9pbnQuXHJcbiAgICovXHJcbiAgX2dldEN1cnJlbnRTaXplKCkge1xyXG4gICAgdmFyIG1hdGNoZWQ7XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnF1ZXJpZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2ldO1xyXG5cclxuICAgICAgaWYgKHdpbmRvdy5tYXRjaE1lZGlhKHF1ZXJ5LnZhbHVlKS5tYXRjaGVzKSB7XHJcbiAgICAgICAgbWF0Y2hlZCA9IHF1ZXJ5O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBtYXRjaGVkID09PSAnb2JqZWN0Jykge1xyXG4gICAgICByZXR1cm4gbWF0Y2hlZC5uYW1lO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIG1hdGNoZWQ7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogQWN0aXZhdGVzIHRoZSBicmVha3BvaW50IHdhdGNoZXIsIHdoaWNoIGZpcmVzIGFuIGV2ZW50IG9uIHRoZSB3aW5kb3cgd2hlbmV2ZXIgdGhlIGJyZWFrcG9pbnQgY2hhbmdlcy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF93YXRjaGVyKCkge1xyXG4gICAgJCh3aW5kb3cpLm9uKCdyZXNpemUuemYubWVkaWFxdWVyeScsICgpID0+IHtcclxuICAgICAgdmFyIG5ld1NpemUgPSB0aGlzLl9nZXRDdXJyZW50U2l6ZSgpLCBjdXJyZW50U2l6ZSA9IHRoaXMuY3VycmVudDtcclxuXHJcbiAgICAgIGlmIChuZXdTaXplICE9PSBjdXJyZW50U2l6ZSkge1xyXG4gICAgICAgIC8vIENoYW5nZSB0aGUgY3VycmVudCBtZWRpYSBxdWVyeVxyXG4gICAgICAgIHRoaXMuY3VycmVudCA9IG5ld1NpemU7XHJcblxyXG4gICAgICAgIC8vIEJyb2FkY2FzdCB0aGUgbWVkaWEgcXVlcnkgY2hhbmdlIG9uIHRoZSB3aW5kb3dcclxuICAgICAgICAkKHdpbmRvdykudHJpZ2dlcignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgW25ld1NpemUsIGN1cnJlbnRTaXplXSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxufTtcclxuXHJcbkZvdW5kYXRpb24uTWVkaWFRdWVyeSA9IE1lZGlhUXVlcnk7XHJcblxyXG4vLyBtYXRjaE1lZGlhKCkgcG9seWZpbGwgLSBUZXN0IGEgQ1NTIG1lZGlhIHR5cGUvcXVlcnkgaW4gSlMuXHJcbi8vIEF1dGhvcnMgJiBjb3B5cmlnaHQgKGMpIDIwMTI6IFNjb3R0IEplaGwsIFBhdWwgSXJpc2gsIE5pY2hvbGFzIFpha2FzLCBEYXZpZCBLbmlnaHQuIER1YWwgTUlUL0JTRCBsaWNlbnNlXHJcbndpbmRvdy5tYXRjaE1lZGlhIHx8ICh3aW5kb3cubWF0Y2hNZWRpYSA9IGZ1bmN0aW9uKCkge1xyXG4gICd1c2Ugc3RyaWN0JztcclxuXHJcbiAgLy8gRm9yIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBtYXRjaE1lZGl1bSBhcGkgc3VjaCBhcyBJRSA5IGFuZCB3ZWJraXRcclxuICB2YXIgc3R5bGVNZWRpYSA9ICh3aW5kb3cuc3R5bGVNZWRpYSB8fCB3aW5kb3cubWVkaWEpO1xyXG5cclxuICAvLyBGb3IgdGhvc2UgdGhhdCBkb24ndCBzdXBwb3J0IG1hdGNoTWVkaXVtXHJcbiAgaWYgKCFzdHlsZU1lZGlhKSB7XHJcbiAgICB2YXIgc3R5bGUgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyksXHJcbiAgICBzY3JpcHQgICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXSxcclxuICAgIGluZm8gICAgICAgID0gbnVsbDtcclxuXHJcbiAgICBzdHlsZS50eXBlICA9ICd0ZXh0L2Nzcyc7XHJcbiAgICBzdHlsZS5pZCAgICA9ICdtYXRjaG1lZGlhanMtdGVzdCc7XHJcblxyXG4gICAgc2NyaXB0ICYmIHNjcmlwdC5wYXJlbnROb2RlICYmIHNjcmlwdC5wYXJlbnROb2RlLmluc2VydEJlZm9yZShzdHlsZSwgc2NyaXB0KTtcclxuXHJcbiAgICAvLyAnc3R5bGUuY3VycmVudFN0eWxlJyBpcyB1c2VkIGJ5IElFIDw9IDggYW5kICd3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZScgZm9yIGFsbCBvdGhlciBicm93c2Vyc1xyXG4gICAgaW5mbyA9ICgnZ2V0Q29tcHV0ZWRTdHlsZScgaW4gd2luZG93KSAmJiB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShzdHlsZSwgbnVsbCkgfHwgc3R5bGUuY3VycmVudFN0eWxlO1xyXG5cclxuICAgIHN0eWxlTWVkaWEgPSB7XHJcbiAgICAgIG1hdGNoTWVkaXVtKG1lZGlhKSB7XHJcbiAgICAgICAgdmFyIHRleHQgPSBgQG1lZGlhICR7bWVkaWF9eyAjbWF0Y2htZWRpYWpzLXRlc3QgeyB3aWR0aDogMXB4OyB9IH1gO1xyXG5cclxuICAgICAgICAvLyAnc3R5bGUuc3R5bGVTaGVldCcgaXMgdXNlZCBieSBJRSA8PSA4IGFuZCAnc3R5bGUudGV4dENvbnRlbnQnIGZvciBhbGwgb3RoZXIgYnJvd3NlcnNcclxuICAgICAgICBpZiAoc3R5bGUuc3R5bGVTaGVldCkge1xyXG4gICAgICAgICAgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gdGV4dDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSB0ZXh0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gVGVzdCBpZiBtZWRpYSBxdWVyeSBpcyB0cnVlIG9yIGZhbHNlXHJcbiAgICAgICAgcmV0dXJuIGluZm8ud2lkdGggPT09ICcxcHgnO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZnVuY3Rpb24obWVkaWEpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIG1hdGNoZXM6IHN0eWxlTWVkaWEubWF0Y2hNZWRpdW0obWVkaWEgfHwgJ2FsbCcpLFxyXG4gICAgICBtZWRpYTogbWVkaWEgfHwgJ2FsbCdcclxuICAgIH07XHJcbiAgfVxyXG59KCkpO1xyXG5cclxuLy8gVGhhbmsgeW91OiBodHRwczovL2dpdGh1Yi5jb20vc2luZHJlc29yaHVzL3F1ZXJ5LXN0cmluZ1xyXG5mdW5jdGlvbiBwYXJzZVN0eWxlVG9PYmplY3Qoc3RyKSB7XHJcbiAgdmFyIHN0eWxlT2JqZWN0ID0ge307XHJcblxyXG4gIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xyXG4gICAgcmV0dXJuIHN0eWxlT2JqZWN0O1xyXG4gIH1cclxuXHJcbiAgc3RyID0gc3RyLnRyaW0oKS5zbGljZSgxLCAtMSk7IC8vIGJyb3dzZXJzIHJlLXF1b3RlIHN0cmluZyBzdHlsZSB2YWx1ZXNcclxuXHJcbiAgaWYgKCFzdHIpIHtcclxuICAgIHJldHVybiBzdHlsZU9iamVjdDtcclxuICB9XHJcblxyXG4gIHN0eWxlT2JqZWN0ID0gc3RyLnNwbGl0KCcmJykucmVkdWNlKGZ1bmN0aW9uKHJldCwgcGFyYW0pIHtcclxuICAgIHZhciBwYXJ0cyA9IHBhcmFtLnJlcGxhY2UoL1xcKy9nLCAnICcpLnNwbGl0KCc9Jyk7XHJcbiAgICB2YXIga2V5ID0gcGFydHNbMF07XHJcbiAgICB2YXIgdmFsID0gcGFydHNbMV07XHJcbiAgICBrZXkgPSBkZWNvZGVVUklDb21wb25lbnQoa2V5KTtcclxuXHJcbiAgICAvLyBtaXNzaW5nIGA9YCBzaG91bGQgYmUgYG51bGxgOlxyXG4gICAgLy8gaHR0cDovL3czLm9yZy9UUi8yMDEyL1dELXVybC0yMDEyMDUyNC8jY29sbGVjdC11cmwtcGFyYW1ldGVyc1xyXG4gICAgdmFsID0gdmFsID09PSB1bmRlZmluZWQgPyBudWxsIDogZGVjb2RlVVJJQ29tcG9uZW50KHZhbCk7XHJcblxyXG4gICAgaWYgKCFyZXQuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG4gICAgICByZXRba2V5XSA9IHZhbDtcclxuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShyZXRba2V5XSkpIHtcclxuICAgICAgcmV0W2tleV0ucHVzaCh2YWwpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0W2tleV0gPSBbcmV0W2tleV0sIHZhbF07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmV0O1xyXG4gIH0sIHt9KTtcclxuXHJcbiAgcmV0dXJuIHN0eWxlT2JqZWN0O1xyXG59XHJcblxyXG5Gb3VuZGF0aW9uLk1lZGlhUXVlcnkgPSBNZWRpYVF1ZXJ5O1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIE1vdGlvbiBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5tb3Rpb25cclxuICovXHJcblxyXG5jb25zdCBpbml0Q2xhc3NlcyAgID0gWydtdWktZW50ZXInLCAnbXVpLWxlYXZlJ107XHJcbmNvbnN0IGFjdGl2ZUNsYXNzZXMgPSBbJ211aS1lbnRlci1hY3RpdmUnLCAnbXVpLWxlYXZlLWFjdGl2ZSddO1xyXG5cclxuY29uc3QgTW90aW9uID0ge1xyXG4gIGFuaW1hdGVJbjogZnVuY3Rpb24oZWxlbWVudCwgYW5pbWF0aW9uLCBjYikge1xyXG4gICAgYW5pbWF0ZSh0cnVlLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKTtcclxuICB9LFxyXG5cclxuICBhbmltYXRlT3V0OiBmdW5jdGlvbihlbGVtZW50LCBhbmltYXRpb24sIGNiKSB7XHJcbiAgICBhbmltYXRlKGZhbHNlLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIE1vdmUoZHVyYXRpb24sIGVsZW0sIGZuKXtcclxuICB2YXIgYW5pbSwgcHJvZywgc3RhcnQgPSBudWxsO1xyXG4gIC8vIGNvbnNvbGUubG9nKCdjYWxsZWQnKTtcclxuXHJcbiAgaWYgKGR1cmF0aW9uID09PSAwKSB7XHJcbiAgICBmbi5hcHBseShlbGVtKTtcclxuICAgIGVsZW0udHJpZ2dlcignZmluaXNoZWQuemYuYW5pbWF0ZScsIFtlbGVtXSkudHJpZ2dlckhhbmRsZXIoJ2ZpbmlzaGVkLnpmLmFuaW1hdGUnLCBbZWxlbV0pO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gbW92ZSh0cyl7XHJcbiAgICBpZighc3RhcnQpIHN0YXJ0ID0gdHM7XHJcbiAgICAvLyBjb25zb2xlLmxvZyhzdGFydCwgdHMpO1xyXG4gICAgcHJvZyA9IHRzIC0gc3RhcnQ7XHJcbiAgICBmbi5hcHBseShlbGVtKTtcclxuXHJcbiAgICBpZihwcm9nIDwgZHVyYXRpb24peyBhbmltID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShtb3ZlLCBlbGVtKTsgfVxyXG4gICAgZWxzZXtcclxuICAgICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKGFuaW0pO1xyXG4gICAgICBlbGVtLnRyaWdnZXIoJ2ZpbmlzaGVkLnpmLmFuaW1hdGUnLCBbZWxlbV0pLnRyaWdnZXJIYW5kbGVyKCdmaW5pc2hlZC56Zi5hbmltYXRlJywgW2VsZW1dKTtcclxuICAgIH1cclxuICB9XHJcbiAgYW5pbSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobW92ZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbmltYXRlcyBhbiBlbGVtZW50IGluIG9yIG91dCB1c2luZyBhIENTUyB0cmFuc2l0aW9uIGNsYXNzLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHByaXZhdGVcclxuICogQHBhcmFtIHtCb29sZWFufSBpc0luIC0gRGVmaW5lcyBpZiB0aGUgYW5pbWF0aW9uIGlzIGluIG9yIG91dC5cclxuICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb3IgSFRNTCBvYmplY3QgdG8gYW5pbWF0ZS5cclxuICogQHBhcmFtIHtTdHJpbmd9IGFuaW1hdGlvbiAtIENTUyBjbGFzcyB0byB1c2UuXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gQ2FsbGJhY2sgdG8gcnVuIHdoZW4gYW5pbWF0aW9uIGlzIGZpbmlzaGVkLlxyXG4gKi9cclxuZnVuY3Rpb24gYW5pbWF0ZShpc0luLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKSB7XHJcbiAgZWxlbWVudCA9ICQoZWxlbWVudCkuZXEoMCk7XHJcblxyXG4gIGlmICghZWxlbWVudC5sZW5ndGgpIHJldHVybjtcclxuXHJcbiAgdmFyIGluaXRDbGFzcyA9IGlzSW4gPyBpbml0Q2xhc3Nlc1swXSA6IGluaXRDbGFzc2VzWzFdO1xyXG4gIHZhciBhY3RpdmVDbGFzcyA9IGlzSW4gPyBhY3RpdmVDbGFzc2VzWzBdIDogYWN0aXZlQ2xhc3Nlc1sxXTtcclxuXHJcbiAgLy8gU2V0IHVwIHRoZSBhbmltYXRpb25cclxuICByZXNldCgpO1xyXG5cclxuICBlbGVtZW50XHJcbiAgICAuYWRkQ2xhc3MoYW5pbWF0aW9uKVxyXG4gICAgLmNzcygndHJhbnNpdGlvbicsICdub25lJyk7XHJcblxyXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XHJcbiAgICBlbGVtZW50LmFkZENsYXNzKGluaXRDbGFzcyk7XHJcbiAgICBpZiAoaXNJbikgZWxlbWVudC5zaG93KCk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFN0YXJ0IHRoZSBhbmltYXRpb25cclxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xyXG4gICAgZWxlbWVudFswXS5vZmZzZXRXaWR0aDtcclxuICAgIGVsZW1lbnRcclxuICAgICAgLmNzcygndHJhbnNpdGlvbicsICcnKVxyXG4gICAgICAuYWRkQ2xhc3MoYWN0aXZlQ2xhc3MpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBDbGVhbiB1cCB0aGUgYW5pbWF0aW9uIHdoZW4gaXQgZmluaXNoZXNcclxuICBlbGVtZW50Lm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQoZWxlbWVudCksIGZpbmlzaCk7XHJcblxyXG4gIC8vIEhpZGVzIHRoZSBlbGVtZW50IChmb3Igb3V0IGFuaW1hdGlvbnMpLCByZXNldHMgdGhlIGVsZW1lbnQsIGFuZCBydW5zIGEgY2FsbGJhY2tcclxuICBmdW5jdGlvbiBmaW5pc2goKSB7XHJcbiAgICBpZiAoIWlzSW4pIGVsZW1lbnQuaGlkZSgpO1xyXG4gICAgcmVzZXQoKTtcclxuICAgIGlmIChjYikgY2IuYXBwbHkoZWxlbWVudCk7XHJcbiAgfVxyXG5cclxuICAvLyBSZXNldHMgdHJhbnNpdGlvbnMgYW5kIHJlbW92ZXMgbW90aW9uLXNwZWNpZmljIGNsYXNzZXNcclxuICBmdW5jdGlvbiByZXNldCgpIHtcclxuICAgIGVsZW1lbnRbMF0uc3R5bGUudHJhbnNpdGlvbkR1cmF0aW9uID0gMDtcclxuICAgIGVsZW1lbnQucmVtb3ZlQ2xhc3MoYCR7aW5pdENsYXNzfSAke2FjdGl2ZUNsYXNzfSAke2FuaW1hdGlvbn1gKTtcclxuICB9XHJcbn1cclxuXHJcbkZvdW5kYXRpb24uTW92ZSA9IE1vdmU7XHJcbkZvdW5kYXRpb24uTW90aW9uID0gTW90aW9uO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuY29uc3QgTmVzdCA9IHtcclxuICBGZWF0aGVyKG1lbnUsIHR5cGUgPSAnemYnKSB7XHJcbiAgICBtZW51LmF0dHIoJ3JvbGUnLCAnbWVudWJhcicpO1xyXG5cclxuICAgIHZhciBpdGVtcyA9IG1lbnUuZmluZCgnbGknKS5hdHRyKHsncm9sZSc6ICdtZW51aXRlbSd9KSxcclxuICAgICAgICBzdWJNZW51Q2xhc3MgPSBgaXMtJHt0eXBlfS1zdWJtZW51YCxcclxuICAgICAgICBzdWJJdGVtQ2xhc3MgPSBgJHtzdWJNZW51Q2xhc3N9LWl0ZW1gLFxyXG4gICAgICAgIGhhc1N1YkNsYXNzID0gYGlzLSR7dHlwZX0tc3VibWVudS1wYXJlbnRgO1xyXG5cclxuICAgIGl0ZW1zLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgIHZhciAkaXRlbSA9ICQodGhpcyksXHJcbiAgICAgICAgICAkc3ViID0gJGl0ZW0uY2hpbGRyZW4oJ3VsJyk7XHJcblxyXG4gICAgICBpZiAoJHN1Yi5sZW5ndGgpIHtcclxuICAgICAgICAkaXRlbVxyXG4gICAgICAgICAgLmFkZENsYXNzKGhhc1N1YkNsYXNzKVxyXG4gICAgICAgICAgLmF0dHIoe1xyXG4gICAgICAgICAgICAnYXJpYS1oYXNwb3B1cCc6IHRydWUsXHJcbiAgICAgICAgICAgICdhcmlhLWxhYmVsJzogJGl0ZW0uY2hpbGRyZW4oJ2E6Zmlyc3QnKS50ZXh0KClcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgLy8gTm90ZTogIERyaWxsZG93bnMgYmVoYXZlIGRpZmZlcmVudGx5IGluIGhvdyB0aGV5IGhpZGUsIGFuZCBzbyBuZWVkXHJcbiAgICAgICAgICAvLyBhZGRpdGlvbmFsIGF0dHJpYnV0ZXMuICBXZSBzaG91bGQgbG9vayBpZiB0aGlzIHBvc3NpYmx5IG92ZXItZ2VuZXJhbGl6ZWRcclxuICAgICAgICAgIC8vIHV0aWxpdHkgKE5lc3QpIGlzIGFwcHJvcHJpYXRlIHdoZW4gd2UgcmV3b3JrIG1lbnVzIGluIDYuNFxyXG4gICAgICAgICAgaWYodHlwZSA9PT0gJ2RyaWxsZG93bicpIHtcclxuICAgICAgICAgICAgJGl0ZW0uYXR0cih7J2FyaWEtZXhwYW5kZWQnOiBmYWxzZX0pO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAkc3ViXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoYHN1Ym1lbnUgJHtzdWJNZW51Q2xhc3N9YClcclxuICAgICAgICAgIC5hdHRyKHtcclxuICAgICAgICAgICAgJ2RhdGEtc3VibWVudSc6ICcnLFxyXG4gICAgICAgICAgICAncm9sZSc6ICdtZW51J1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgaWYodHlwZSA9PT0gJ2RyaWxsZG93bicpIHtcclxuICAgICAgICAgICRzdWIuYXR0cih7J2FyaWEtaGlkZGVuJzogdHJ1ZX0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCRpdGVtLnBhcmVudCgnW2RhdGEtc3VibWVudV0nKS5sZW5ndGgpIHtcclxuICAgICAgICAkaXRlbS5hZGRDbGFzcyhgaXMtc3VibWVudS1pdGVtICR7c3ViSXRlbUNsYXNzfWApO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm47XHJcbiAgfSxcclxuXHJcbiAgQnVybihtZW51LCB0eXBlKSB7XHJcbiAgICB2YXIgLy9pdGVtcyA9IG1lbnUuZmluZCgnbGknKSxcclxuICAgICAgICBzdWJNZW51Q2xhc3MgPSBgaXMtJHt0eXBlfS1zdWJtZW51YCxcclxuICAgICAgICBzdWJJdGVtQ2xhc3MgPSBgJHtzdWJNZW51Q2xhc3N9LWl0ZW1gLFxyXG4gICAgICAgIGhhc1N1YkNsYXNzID0gYGlzLSR7dHlwZX0tc3VibWVudS1wYXJlbnRgO1xyXG5cclxuICAgIG1lbnVcclxuICAgICAgLmZpbmQoJz5saSwgLm1lbnUsIC5tZW51ID4gbGknKVxyXG4gICAgICAucmVtb3ZlQ2xhc3MoYCR7c3ViTWVudUNsYXNzfSAke3N1Ykl0ZW1DbGFzc30gJHtoYXNTdWJDbGFzc30gaXMtc3VibWVudS1pdGVtIHN1Ym1lbnUgaXMtYWN0aXZlYClcclxuICAgICAgLnJlbW92ZUF0dHIoJ2RhdGEtc3VibWVudScpLmNzcygnZGlzcGxheScsICcnKTtcclxuXHJcbiAgICAvLyBjb25zb2xlLmxvZyggICAgICBtZW51LmZpbmQoJy4nICsgc3ViTWVudUNsYXNzICsgJywgLicgKyBzdWJJdGVtQ2xhc3MgKyAnLCAuaGFzLXN1Ym1lbnUsIC5pcy1zdWJtZW51LWl0ZW0sIC5zdWJtZW51LCBbZGF0YS1zdWJtZW51XScpXHJcbiAgICAvLyAgICAgICAgICAgLnJlbW92ZUNsYXNzKHN1Yk1lbnVDbGFzcyArICcgJyArIHN1Ykl0ZW1DbGFzcyArICcgaGFzLXN1Ym1lbnUgaXMtc3VibWVudS1pdGVtIHN1Ym1lbnUnKVxyXG4gICAgLy8gICAgICAgICAgIC5yZW1vdmVBdHRyKCdkYXRhLXN1Ym1lbnUnKSk7XHJcbiAgICAvLyBpdGVtcy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAvLyAgIHZhciAkaXRlbSA9ICQodGhpcyksXHJcbiAgICAvLyAgICAgICAkc3ViID0gJGl0ZW0uY2hpbGRyZW4oJ3VsJyk7XHJcbiAgICAvLyAgIGlmKCRpdGVtLnBhcmVudCgnW2RhdGEtc3VibWVudV0nKS5sZW5ndGgpe1xyXG4gICAgLy8gICAgICRpdGVtLnJlbW92ZUNsYXNzKCdpcy1zdWJtZW51LWl0ZW0gJyArIHN1Ykl0ZW1DbGFzcyk7XHJcbiAgICAvLyAgIH1cclxuICAgIC8vICAgaWYoJHN1Yi5sZW5ndGgpe1xyXG4gICAgLy8gICAgICRpdGVtLnJlbW92ZUNsYXNzKCdoYXMtc3VibWVudScpO1xyXG4gICAgLy8gICAgICRzdWIucmVtb3ZlQ2xhc3MoJ3N1Ym1lbnUgJyArIHN1Yk1lbnVDbGFzcykucmVtb3ZlQXR0cignZGF0YS1zdWJtZW51Jyk7XHJcbiAgICAvLyAgIH1cclxuICAgIC8vIH0pO1xyXG4gIH1cclxufVxyXG5cclxuRm91bmRhdGlvbi5OZXN0ID0gTmVzdDtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbmZ1bmN0aW9uIFRpbWVyKGVsZW0sIG9wdGlvbnMsIGNiKSB7XHJcbiAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgZHVyYXRpb24gPSBvcHRpb25zLmR1cmF0aW9uLC8vb3B0aW9ucyBpcyBhbiBvYmplY3QgZm9yIGVhc2lseSBhZGRpbmcgZmVhdHVyZXMgbGF0ZXIuXHJcbiAgICAgIG5hbWVTcGFjZSA9IE9iamVjdC5rZXlzKGVsZW0uZGF0YSgpKVswXSB8fCAndGltZXInLFxyXG4gICAgICByZW1haW4gPSAtMSxcclxuICAgICAgc3RhcnQsXHJcbiAgICAgIHRpbWVyO1xyXG5cclxuICB0aGlzLmlzUGF1c2VkID0gZmFsc2U7XHJcblxyXG4gIHRoaXMucmVzdGFydCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmVtYWluID0gLTE7XHJcbiAgICBjbGVhclRpbWVvdXQodGltZXIpO1xyXG4gICAgdGhpcy5zdGFydCgpO1xyXG4gIH1cclxuXHJcbiAgdGhpcy5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5pc1BhdXNlZCA9IGZhbHNlO1xyXG4gICAgLy8gaWYoIWVsZW0uZGF0YSgncGF1c2VkJykpeyByZXR1cm4gZmFsc2U7IH0vL21heWJlIGltcGxlbWVudCB0aGlzIHNhbml0eSBjaGVjayBpZiB1c2VkIGZvciBvdGhlciB0aGluZ3MuXHJcbiAgICBjbGVhclRpbWVvdXQodGltZXIpO1xyXG4gICAgcmVtYWluID0gcmVtYWluIDw9IDAgPyBkdXJhdGlvbiA6IHJlbWFpbjtcclxuICAgIGVsZW0uZGF0YSgncGF1c2VkJywgZmFsc2UpO1xyXG4gICAgc3RhcnQgPSBEYXRlLm5vdygpO1xyXG4gICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgIGlmKG9wdGlvbnMuaW5maW5pdGUpe1xyXG4gICAgICAgIF90aGlzLnJlc3RhcnQoKTsvL3JlcnVuIHRoZSB0aW1lci5cclxuICAgICAgfVxyXG4gICAgICBpZiAoY2IgJiYgdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7IGNiKCk7IH1cclxuICAgIH0sIHJlbWFpbik7XHJcbiAgICBlbGVtLnRyaWdnZXIoYHRpbWVyc3RhcnQuemYuJHtuYW1lU3BhY2V9YCk7XHJcbiAgfVxyXG5cclxuICB0aGlzLnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmlzUGF1c2VkID0gdHJ1ZTtcclxuICAgIC8vaWYoZWxlbS5kYXRhKCdwYXVzZWQnKSl7IHJldHVybiBmYWxzZTsgfS8vbWF5YmUgaW1wbGVtZW50IHRoaXMgc2FuaXR5IGNoZWNrIGlmIHVzZWQgZm9yIG90aGVyIHRoaW5ncy5cclxuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XHJcbiAgICBlbGVtLmRhdGEoJ3BhdXNlZCcsIHRydWUpO1xyXG4gICAgdmFyIGVuZCA9IERhdGUubm93KCk7XHJcbiAgICByZW1haW4gPSByZW1haW4gLSAoZW5kIC0gc3RhcnQpO1xyXG4gICAgZWxlbS50cmlnZ2VyKGB0aW1lcnBhdXNlZC56Zi4ke25hbWVTcGFjZX1gKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSdW5zIGEgY2FsbGJhY2sgZnVuY3Rpb24gd2hlbiBpbWFnZXMgYXJlIGZ1bGx5IGxvYWRlZC5cclxuICogQHBhcmFtIHtPYmplY3R9IGltYWdlcyAtIEltYWdlKHMpIHRvIGNoZWNrIGlmIGxvYWRlZC5cclxuICogQHBhcmFtIHtGdW5jfSBjYWxsYmFjayAtIEZ1bmN0aW9uIHRvIGV4ZWN1dGUgd2hlbiBpbWFnZSBpcyBmdWxseSBsb2FkZWQuXHJcbiAqL1xyXG5mdW5jdGlvbiBvbkltYWdlc0xvYWRlZChpbWFnZXMsIGNhbGxiYWNrKXtcclxuICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgIHVubG9hZGVkID0gaW1hZ2VzLmxlbmd0aDtcclxuXHJcbiAgaWYgKHVubG9hZGVkID09PSAwKSB7XHJcbiAgICBjYWxsYmFjaygpO1xyXG4gIH1cclxuXHJcbiAgaW1hZ2VzLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAvLyBDaGVjayBpZiBpbWFnZSBpcyBsb2FkZWRcclxuICAgIGlmICh0aGlzLmNvbXBsZXRlIHx8ICh0aGlzLnJlYWR5U3RhdGUgPT09IDQpIHx8ICh0aGlzLnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScpKSB7XHJcbiAgICAgIHNpbmdsZUltYWdlTG9hZGVkKCk7XHJcbiAgICB9XHJcbiAgICAvLyBGb3JjZSBsb2FkIHRoZSBpbWFnZVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIC8vIGZpeCBmb3IgSUUuIFNlZSBodHRwczovL2Nzcy10cmlja3MuY29tL3NuaXBwZXRzL2pxdWVyeS9maXhpbmctbG9hZC1pbi1pZS1mb3ItY2FjaGVkLWltYWdlcy9cclxuICAgICAgdmFyIHNyYyA9ICQodGhpcykuYXR0cignc3JjJyk7XHJcbiAgICAgICQodGhpcykuYXR0cignc3JjJywgc3JjICsgJz8nICsgKG5ldyBEYXRlKCkuZ2V0VGltZSgpKSk7XHJcbiAgICAgICQodGhpcykub25lKCdsb2FkJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgc2luZ2xlSW1hZ2VMb2FkZWQoKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIGZ1bmN0aW9uIHNpbmdsZUltYWdlTG9hZGVkKCkge1xyXG4gICAgdW5sb2FkZWQtLTtcclxuICAgIGlmICh1bmxvYWRlZCA9PT0gMCkge1xyXG4gICAgICBjYWxsYmFjaygpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuRm91bmRhdGlvbi5UaW1lciA9IFRpbWVyO1xyXG5Gb3VuZGF0aW9uLm9uSW1hZ2VzTG9hZGVkID0gb25JbWFnZXNMb2FkZWQ7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuLy8qKldvcmsgaW5zcGlyZWQgYnkgbXVsdGlwbGUganF1ZXJ5IHN3aXBlIHBsdWdpbnMqKlxyXG4vLyoqRG9uZSBieSBZb2hhaSBBcmFyYXQgKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuKGZ1bmN0aW9uKCQpIHtcclxuXHJcbiAgJC5zcG90U3dpcGUgPSB7XHJcbiAgICB2ZXJzaW9uOiAnMS4wLjAnLFxyXG4gICAgZW5hYmxlZDogJ29udG91Y2hzdGFydCcgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LFxyXG4gICAgcHJldmVudERlZmF1bHQ6IGZhbHNlLFxyXG4gICAgbW92ZVRocmVzaG9sZDogNzUsXHJcbiAgICB0aW1lVGhyZXNob2xkOiAyMDBcclxuICB9O1xyXG5cclxuICB2YXIgICBzdGFydFBvc1gsXHJcbiAgICAgICAgc3RhcnRQb3NZLFxyXG4gICAgICAgIHN0YXJ0VGltZSxcclxuICAgICAgICBlbGFwc2VkVGltZSxcclxuICAgICAgICBpc01vdmluZyA9IGZhbHNlO1xyXG5cclxuICBmdW5jdGlvbiBvblRvdWNoRW5kKCkge1xyXG4gICAgLy8gIGFsZXJ0KHRoaXMpO1xyXG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBvblRvdWNoTW92ZSk7XHJcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgb25Ub3VjaEVuZCk7XHJcbiAgICBpc01vdmluZyA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gb25Ub3VjaE1vdmUoZSkge1xyXG4gICAgaWYgKCQuc3BvdFN3aXBlLnByZXZlbnREZWZhdWx0KSB7IGUucHJldmVudERlZmF1bHQoKTsgfVxyXG4gICAgaWYoaXNNb3ZpbmcpIHtcclxuICAgICAgdmFyIHggPSBlLnRvdWNoZXNbMF0ucGFnZVg7XHJcbiAgICAgIHZhciB5ID0gZS50b3VjaGVzWzBdLnBhZ2VZO1xyXG4gICAgICB2YXIgZHggPSBzdGFydFBvc1ggLSB4O1xyXG4gICAgICB2YXIgZHkgPSBzdGFydFBvc1kgLSB5O1xyXG4gICAgICB2YXIgZGlyO1xyXG4gICAgICBlbGFwc2VkVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnRUaW1lO1xyXG4gICAgICBpZihNYXRoLmFicyhkeCkgPj0gJC5zcG90U3dpcGUubW92ZVRocmVzaG9sZCAmJiBlbGFwc2VkVGltZSA8PSAkLnNwb3RTd2lwZS50aW1lVGhyZXNob2xkKSB7XHJcbiAgICAgICAgZGlyID0gZHggPiAwID8gJ2xlZnQnIDogJ3JpZ2h0JztcclxuICAgICAgfVxyXG4gICAgICAvLyBlbHNlIGlmKE1hdGguYWJzKGR5KSA+PSAkLnNwb3RTd2lwZS5tb3ZlVGhyZXNob2xkICYmIGVsYXBzZWRUaW1lIDw9ICQuc3BvdFN3aXBlLnRpbWVUaHJlc2hvbGQpIHtcclxuICAgICAgLy8gICBkaXIgPSBkeSA+IDAgPyAnZG93bicgOiAndXAnO1xyXG4gICAgICAvLyB9XHJcbiAgICAgIGlmKGRpcikge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBvblRvdWNoRW5kLmNhbGwodGhpcyk7XHJcbiAgICAgICAgJCh0aGlzKS50cmlnZ2VyKCdzd2lwZScsIGRpcikudHJpZ2dlcihgc3dpcGUke2Rpcn1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gb25Ub3VjaFN0YXJ0KGUpIHtcclxuICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcclxuICAgICAgc3RhcnRQb3NYID0gZS50b3VjaGVzWzBdLnBhZ2VYO1xyXG4gICAgICBzdGFydFBvc1kgPSBlLnRvdWNoZXNbMF0ucGFnZVk7XHJcbiAgICAgIGlzTW92aW5nID0gdHJ1ZTtcclxuICAgICAgc3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgb25Ub3VjaE1vdmUsIGZhbHNlKTtcclxuICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIG9uVG91Y2hFbmQsIGZhbHNlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIgJiYgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0Jywgb25Ub3VjaFN0YXJ0LCBmYWxzZSk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiB0ZWFyZG93bigpIHtcclxuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uVG91Y2hTdGFydCk7XHJcbiAgfVxyXG5cclxuICAkLmV2ZW50LnNwZWNpYWwuc3dpcGUgPSB7IHNldHVwOiBpbml0IH07XHJcblxyXG4gICQuZWFjaChbJ2xlZnQnLCAndXAnLCAnZG93bicsICdyaWdodCddLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAkLmV2ZW50LnNwZWNpYWxbYHN3aXBlJHt0aGlzfWBdID0geyBzZXR1cDogZnVuY3Rpb24oKXtcclxuICAgICAgJCh0aGlzKS5vbignc3dpcGUnLCAkLm5vb3ApO1xyXG4gICAgfSB9O1xyXG4gIH0pO1xyXG59KShqUXVlcnkpO1xyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gKiBNZXRob2QgZm9yIGFkZGluZyBwc3VlZG8gZHJhZyBldmVudHMgdG8gZWxlbWVudHMgKlxyXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG4hZnVuY3Rpb24oJCl7XHJcbiAgJC5mbi5hZGRUb3VjaCA9IGZ1bmN0aW9uKCl7XHJcbiAgICB0aGlzLmVhY2goZnVuY3Rpb24oaSxlbCl7XHJcbiAgICAgICQoZWwpLmJpbmQoJ3RvdWNoc3RhcnQgdG91Y2htb3ZlIHRvdWNoZW5kIHRvdWNoY2FuY2VsJyxmdW5jdGlvbigpe1xyXG4gICAgICAgIC8vd2UgcGFzcyB0aGUgb3JpZ2luYWwgZXZlbnQgb2JqZWN0IGJlY2F1c2UgdGhlIGpRdWVyeSBldmVudFxyXG4gICAgICAgIC8vb2JqZWN0IGlzIG5vcm1hbGl6ZWQgdG8gdzNjIHNwZWNzIGFuZCBkb2VzIG5vdCBwcm92aWRlIHRoZSBUb3VjaExpc3RcclxuICAgICAgICBoYW5kbGVUb3VjaChldmVudCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdmFyIGhhbmRsZVRvdWNoID0gZnVuY3Rpb24oZXZlbnQpe1xyXG4gICAgICB2YXIgdG91Y2hlcyA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLFxyXG4gICAgICAgICAgZmlyc3QgPSB0b3VjaGVzWzBdLFxyXG4gICAgICAgICAgZXZlbnRUeXBlcyA9IHtcclxuICAgICAgICAgICAgdG91Y2hzdGFydDogJ21vdXNlZG93bicsXHJcbiAgICAgICAgICAgIHRvdWNobW92ZTogJ21vdXNlbW92ZScsXHJcbiAgICAgICAgICAgIHRvdWNoZW5kOiAnbW91c2V1cCdcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB0eXBlID0gZXZlbnRUeXBlc1tldmVudC50eXBlXSxcclxuICAgICAgICAgIHNpbXVsYXRlZEV2ZW50XHJcbiAgICAgICAgO1xyXG5cclxuICAgICAgaWYoJ01vdXNlRXZlbnQnIGluIHdpbmRvdyAmJiB0eXBlb2Ygd2luZG93Lk1vdXNlRXZlbnQgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBzaW11bGF0ZWRFdmVudCA9IG5ldyB3aW5kb3cuTW91c2VFdmVudCh0eXBlLCB7XHJcbiAgICAgICAgICAnYnViYmxlcyc6IHRydWUsXHJcbiAgICAgICAgICAnY2FuY2VsYWJsZSc6IHRydWUsXHJcbiAgICAgICAgICAnc2NyZWVuWCc6IGZpcnN0LnNjcmVlblgsXHJcbiAgICAgICAgICAnc2NyZWVuWSc6IGZpcnN0LnNjcmVlblksXHJcbiAgICAgICAgICAnY2xpZW50WCc6IGZpcnN0LmNsaWVudFgsXHJcbiAgICAgICAgICAnY2xpZW50WSc6IGZpcnN0LmNsaWVudFlcclxuICAgICAgICB9KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzaW11bGF0ZWRFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50Jyk7XHJcbiAgICAgICAgc2ltdWxhdGVkRXZlbnQuaW5pdE1vdXNlRXZlbnQodHlwZSwgdHJ1ZSwgdHJ1ZSwgd2luZG93LCAxLCBmaXJzdC5zY3JlZW5YLCBmaXJzdC5zY3JlZW5ZLCBmaXJzdC5jbGllbnRYLCBmaXJzdC5jbGllbnRZLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgMC8qbGVmdCovLCBudWxsKTtcclxuICAgICAgfVxyXG4gICAgICBmaXJzdC50YXJnZXQuZGlzcGF0Y2hFdmVudChzaW11bGF0ZWRFdmVudCk7XHJcbiAgICB9O1xyXG4gIH07XHJcbn0oalF1ZXJ5KTtcclxuXHJcblxyXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuLy8qKkZyb20gdGhlIGpRdWVyeSBNb2JpbGUgTGlicmFyeSoqXHJcbi8vKipuZWVkIHRvIHJlY3JlYXRlIGZ1bmN0aW9uYWxpdHkqKlxyXG4vLyoqYW5kIHRyeSB0byBpbXByb3ZlIGlmIHBvc3NpYmxlKipcclxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcblxyXG4vKiBSZW1vdmluZyB0aGUgalF1ZXJ5IGZ1bmN0aW9uICoqKipcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcblxyXG4oZnVuY3Rpb24oICQsIHdpbmRvdywgdW5kZWZpbmVkICkge1xyXG5cclxuXHR2YXIgJGRvY3VtZW50ID0gJCggZG9jdW1lbnQgKSxcclxuXHRcdC8vIHN1cHBvcnRUb3VjaCA9ICQubW9iaWxlLnN1cHBvcnQudG91Y2gsXHJcblx0XHR0b3VjaFN0YXJ0RXZlbnQgPSAndG91Y2hzdGFydCcvL3N1cHBvcnRUb3VjaCA/IFwidG91Y2hzdGFydFwiIDogXCJtb3VzZWRvd25cIixcclxuXHRcdHRvdWNoU3RvcEV2ZW50ID0gJ3RvdWNoZW5kJy8vc3VwcG9ydFRvdWNoID8gXCJ0b3VjaGVuZFwiIDogXCJtb3VzZXVwXCIsXHJcblx0XHR0b3VjaE1vdmVFdmVudCA9ICd0b3VjaG1vdmUnLy9zdXBwb3J0VG91Y2ggPyBcInRvdWNobW92ZVwiIDogXCJtb3VzZW1vdmVcIjtcclxuXHJcblx0Ly8gc2V0dXAgbmV3IGV2ZW50IHNob3J0Y3V0c1xyXG5cdCQuZWFjaCggKCBcInRvdWNoc3RhcnQgdG91Y2htb3ZlIHRvdWNoZW5kIFwiICtcclxuXHRcdFwic3dpcGUgc3dpcGVsZWZ0IHN3aXBlcmlnaHRcIiApLnNwbGl0KCBcIiBcIiApLCBmdW5jdGlvbiggaSwgbmFtZSApIHtcclxuXHJcblx0XHQkLmZuWyBuYW1lIF0gPSBmdW5jdGlvbiggZm4gKSB7XHJcblx0XHRcdHJldHVybiBmbiA/IHRoaXMuYmluZCggbmFtZSwgZm4gKSA6IHRoaXMudHJpZ2dlciggbmFtZSApO1xyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBqUXVlcnkgPCAxLjhcclxuXHRcdGlmICggJC5hdHRyRm4gKSB7XHJcblx0XHRcdCQuYXR0ckZuWyBuYW1lIF0gPSB0cnVlO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHRmdW5jdGlvbiB0cmlnZ2VyQ3VzdG9tRXZlbnQoIG9iaiwgZXZlbnRUeXBlLCBldmVudCwgYnViYmxlICkge1xyXG5cdFx0dmFyIG9yaWdpbmFsVHlwZSA9IGV2ZW50LnR5cGU7XHJcblx0XHRldmVudC50eXBlID0gZXZlbnRUeXBlO1xyXG5cdFx0aWYgKCBidWJibGUgKSB7XHJcblx0XHRcdCQuZXZlbnQudHJpZ2dlciggZXZlbnQsIHVuZGVmaW5lZCwgb2JqICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkLmV2ZW50LmRpc3BhdGNoLmNhbGwoIG9iaiwgZXZlbnQgKTtcclxuXHRcdH1cclxuXHRcdGV2ZW50LnR5cGUgPSBvcmlnaW5hbFR5cGU7XHJcblx0fVxyXG5cclxuXHQvLyBhbHNvIGhhbmRsZXMgdGFwaG9sZFxyXG5cclxuXHQvLyBBbHNvIGhhbmRsZXMgc3dpcGVsZWZ0LCBzd2lwZXJpZ2h0XHJcblx0JC5ldmVudC5zcGVjaWFsLnN3aXBlID0ge1xyXG5cclxuXHRcdC8vIE1vcmUgdGhhbiB0aGlzIGhvcml6b250YWwgZGlzcGxhY2VtZW50LCBhbmQgd2Ugd2lsbCBzdXBwcmVzcyBzY3JvbGxpbmcuXHJcblx0XHRzY3JvbGxTdXByZXNzaW9uVGhyZXNob2xkOiAzMCxcclxuXHJcblx0XHQvLyBNb3JlIHRpbWUgdGhhbiB0aGlzLCBhbmQgaXQgaXNuJ3QgYSBzd2lwZS5cclxuXHRcdGR1cmF0aW9uVGhyZXNob2xkOiAxMDAwLFxyXG5cclxuXHRcdC8vIFN3aXBlIGhvcml6b250YWwgZGlzcGxhY2VtZW50IG11c3QgYmUgbW9yZSB0aGFuIHRoaXMuXHJcblx0XHRob3Jpem9udGFsRGlzdGFuY2VUaHJlc2hvbGQ6IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvID49IDIgPyAxNSA6IDMwLFxyXG5cclxuXHRcdC8vIFN3aXBlIHZlcnRpY2FsIGRpc3BsYWNlbWVudCBtdXN0IGJlIGxlc3MgdGhhbiB0aGlzLlxyXG5cdFx0dmVydGljYWxEaXN0YW5jZVRocmVzaG9sZDogd2luZG93LmRldmljZVBpeGVsUmF0aW8gPj0gMiA/IDE1IDogMzAsXHJcblxyXG5cdFx0Z2V0TG9jYXRpb246IGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciB3aW5QYWdlWCA9IHdpbmRvdy5wYWdlWE9mZnNldCxcclxuXHRcdFx0XHR3aW5QYWdlWSA9IHdpbmRvdy5wYWdlWU9mZnNldCxcclxuXHRcdFx0XHR4ID0gZXZlbnQuY2xpZW50WCxcclxuXHRcdFx0XHR5ID0gZXZlbnQuY2xpZW50WTtcclxuXHJcblx0XHRcdGlmICggZXZlbnQucGFnZVkgPT09IDAgJiYgTWF0aC5mbG9vciggeSApID4gTWF0aC5mbG9vciggZXZlbnQucGFnZVkgKSB8fFxyXG5cdFx0XHRcdGV2ZW50LnBhZ2VYID09PSAwICYmIE1hdGguZmxvb3IoIHggKSA+IE1hdGguZmxvb3IoIGV2ZW50LnBhZ2VYICkgKSB7XHJcblxyXG5cdFx0XHRcdC8vIGlPUzQgY2xpZW50WC9jbGllbnRZIGhhdmUgdGhlIHZhbHVlIHRoYXQgc2hvdWxkIGhhdmUgYmVlblxyXG5cdFx0XHRcdC8vIGluIHBhZ2VYL3BhZ2VZLiBXaGlsZSBwYWdlWC9wYWdlLyBoYXZlIHRoZSB2YWx1ZSAwXHJcblx0XHRcdFx0eCA9IHggLSB3aW5QYWdlWDtcclxuXHRcdFx0XHR5ID0geSAtIHdpblBhZ2VZO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCB5IDwgKCBldmVudC5wYWdlWSAtIHdpblBhZ2VZKSB8fCB4IDwgKCBldmVudC5wYWdlWCAtIHdpblBhZ2VYICkgKSB7XHJcblxyXG5cdFx0XHRcdC8vIFNvbWUgQW5kcm9pZCBicm93c2VycyBoYXZlIHRvdGFsbHkgYm9ndXMgdmFsdWVzIGZvciBjbGllbnRYL1lcclxuXHRcdFx0XHQvLyB3aGVuIHNjcm9sbGluZy96b29taW5nIGEgcGFnZS4gRGV0ZWN0YWJsZSBzaW5jZSBjbGllbnRYL2NsaWVudFlcclxuXHRcdFx0XHQvLyBzaG91bGQgbmV2ZXIgYmUgc21hbGxlciB0aGFuIHBhZ2VYL3BhZ2VZIG1pbnVzIHBhZ2Ugc2Nyb2xsXHJcblx0XHRcdFx0eCA9IGV2ZW50LnBhZ2VYIC0gd2luUGFnZVg7XHJcblx0XHRcdFx0eSA9IGV2ZW50LnBhZ2VZIC0gd2luUGFnZVk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0eDogeCxcclxuXHRcdFx0XHR5OiB5XHJcblx0XHRcdH07XHJcblx0XHR9LFxyXG5cclxuXHRcdHN0YXJ0OiBmdW5jdGlvbiggZXZlbnQgKSB7XHJcblx0XHRcdHZhciBkYXRhID0gZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzID9cclxuXHRcdFx0XHRcdGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlc1sgMCBdIDogZXZlbnQsXHJcblx0XHRcdFx0bG9jYXRpb24gPSAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuZ2V0TG9jYXRpb24oIGRhdGEgKTtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRcdFx0dGltZTogKCBuZXcgRGF0ZSgpICkuZ2V0VGltZSgpLFxyXG5cdFx0XHRcdFx0XHRjb29yZHM6IFsgbG9jYXRpb24ueCwgbG9jYXRpb24ueSBdLFxyXG5cdFx0XHRcdFx0XHRvcmlnaW46ICQoIGV2ZW50LnRhcmdldCApXHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0fSxcclxuXHJcblx0XHRzdG9wOiBmdW5jdGlvbiggZXZlbnQgKSB7XHJcblx0XHRcdHZhciBkYXRhID0gZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzID9cclxuXHRcdFx0XHRcdGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlc1sgMCBdIDogZXZlbnQsXHJcblx0XHRcdFx0bG9jYXRpb24gPSAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuZ2V0TG9jYXRpb24oIGRhdGEgKTtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRcdFx0dGltZTogKCBuZXcgRGF0ZSgpICkuZ2V0VGltZSgpLFxyXG5cdFx0XHRcdFx0XHRjb29yZHM6IFsgbG9jYXRpb24ueCwgbG9jYXRpb24ueSBdXHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0fSxcclxuXHJcblx0XHRoYW5kbGVTd2lwZTogZnVuY3Rpb24oIHN0YXJ0LCBzdG9wLCB0aGlzT2JqZWN0LCBvcmlnVGFyZ2V0ICkge1xyXG5cdFx0XHRpZiAoIHN0b3AudGltZSAtIHN0YXJ0LnRpbWUgPCAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuZHVyYXRpb25UaHJlc2hvbGQgJiZcclxuXHRcdFx0XHRNYXRoLmFicyggc3RhcnQuY29vcmRzWyAwIF0gLSBzdG9wLmNvb3Jkc1sgMCBdICkgPiAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuaG9yaXpvbnRhbERpc3RhbmNlVGhyZXNob2xkICYmXHJcblx0XHRcdFx0TWF0aC5hYnMoIHN0YXJ0LmNvb3Jkc1sgMSBdIC0gc3RvcC5jb29yZHNbIDEgXSApIDwgJC5ldmVudC5zcGVjaWFsLnN3aXBlLnZlcnRpY2FsRGlzdGFuY2VUaHJlc2hvbGQgKSB7XHJcblx0XHRcdFx0dmFyIGRpcmVjdGlvbiA9IHN0YXJ0LmNvb3Jkc1swXSA+IHN0b3AuY29vcmRzWyAwIF0gPyBcInN3aXBlbGVmdFwiIDogXCJzd2lwZXJpZ2h0XCI7XHJcblxyXG5cdFx0XHRcdHRyaWdnZXJDdXN0b21FdmVudCggdGhpc09iamVjdCwgXCJzd2lwZVwiLCAkLkV2ZW50KCBcInN3aXBlXCIsIHsgdGFyZ2V0OiBvcmlnVGFyZ2V0LCBzd2lwZXN0YXJ0OiBzdGFydCwgc3dpcGVzdG9wOiBzdG9wIH0pLCB0cnVlICk7XHJcblx0XHRcdFx0dHJpZ2dlckN1c3RvbUV2ZW50KCB0aGlzT2JqZWN0LCBkaXJlY3Rpb24sJC5FdmVudCggZGlyZWN0aW9uLCB7IHRhcmdldDogb3JpZ1RhcmdldCwgc3dpcGVzdGFydDogc3RhcnQsIHN3aXBlc3RvcDogc3RvcCB9ICksIHRydWUgKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblxyXG5cdFx0fSxcclxuXHJcblx0XHQvLyBUaGlzIHNlcnZlcyBhcyBhIGZsYWcgdG8gZW5zdXJlIHRoYXQgYXQgbW9zdCBvbmUgc3dpcGUgZXZlbnQgZXZlbnQgaXNcclxuXHRcdC8vIGluIHdvcmsgYXQgYW55IGdpdmVuIHRpbWVcclxuXHRcdGV2ZW50SW5Qcm9ncmVzczogZmFsc2UsXHJcblxyXG5cdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgZXZlbnRzLFxyXG5cdFx0XHRcdHRoaXNPYmplY3QgPSB0aGlzLFxyXG5cdFx0XHRcdCR0aGlzID0gJCggdGhpc09iamVjdCApLFxyXG5cdFx0XHRcdGNvbnRleHQgPSB7fTtcclxuXHJcblx0XHRcdC8vIFJldHJpZXZlIHRoZSBldmVudHMgZGF0YSBmb3IgdGhpcyBlbGVtZW50IGFuZCBhZGQgdGhlIHN3aXBlIGNvbnRleHRcclxuXHRcdFx0ZXZlbnRzID0gJC5kYXRhKCB0aGlzLCBcIm1vYmlsZS1ldmVudHNcIiApO1xyXG5cdFx0XHRpZiAoICFldmVudHMgKSB7XHJcblx0XHRcdFx0ZXZlbnRzID0geyBsZW5ndGg6IDAgfTtcclxuXHRcdFx0XHQkLmRhdGEoIHRoaXMsIFwibW9iaWxlLWV2ZW50c1wiLCBldmVudHMgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRldmVudHMubGVuZ3RoKys7XHJcblx0XHRcdGV2ZW50cy5zd2lwZSA9IGNvbnRleHQ7XHJcblxyXG5cdFx0XHRjb250ZXh0LnN0YXJ0ID0gZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cclxuXHRcdFx0XHQvLyBCYWlsIGlmIHdlJ3JlIGFscmVhZHkgd29ya2luZyBvbiBhIHN3aXBlIGV2ZW50XHJcblx0XHRcdFx0aWYgKCAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuZXZlbnRJblByb2dyZXNzICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQkLmV2ZW50LnNwZWNpYWwuc3dpcGUuZXZlbnRJblByb2dyZXNzID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0dmFyIHN0b3AsXHJcblx0XHRcdFx0XHRzdGFydCA9ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5zdGFydCggZXZlbnQgKSxcclxuXHRcdFx0XHRcdG9yaWdUYXJnZXQgPSBldmVudC50YXJnZXQsXHJcblx0XHRcdFx0XHRlbWl0dGVkID0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdGNvbnRleHQubW92ZSA9IGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0XHRcdGlmICggIXN0YXJ0IHx8IGV2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0c3RvcCA9ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5zdG9wKCBldmVudCApO1xyXG5cdFx0XHRcdFx0aWYgKCAhZW1pdHRlZCApIHtcclxuXHRcdFx0XHRcdFx0ZW1pdHRlZCA9ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5oYW5kbGVTd2lwZSggc3RhcnQsIHN0b3AsIHRoaXNPYmplY3QsIG9yaWdUYXJnZXQgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBlbWl0dGVkICkge1xyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyBSZXNldCB0aGUgY29udGV4dCB0byBtYWtlIHdheSBmb3IgdGhlIG5leHQgc3dpcGUgZXZlbnRcclxuXHRcdFx0XHRcdFx0XHQkLmV2ZW50LnNwZWNpYWwuc3dpcGUuZXZlbnRJblByb2dyZXNzID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdC8vIHByZXZlbnQgc2Nyb2xsaW5nXHJcblx0XHRcdFx0XHRpZiAoIE1hdGguYWJzKCBzdGFydC5jb29yZHNbIDAgXSAtIHN0b3AuY29vcmRzWyAwIF0gKSA+ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5zY3JvbGxTdXByZXNzaW9uVGhyZXNob2xkICkge1xyXG5cdFx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdGNvbnRleHQuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHRlbWl0dGVkID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIFJlc2V0IHRoZSBjb250ZXh0IHRvIG1ha2Ugd2F5IGZvciB0aGUgbmV4dCBzd2lwZSBldmVudFxyXG5cdFx0XHRcdFx0XHQkLmV2ZW50LnNwZWNpYWwuc3dpcGUuZXZlbnRJblByb2dyZXNzID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdCRkb2N1bWVudC5vZmYoIHRvdWNoTW92ZUV2ZW50LCBjb250ZXh0Lm1vdmUgKTtcclxuXHRcdFx0XHRcdFx0Y29udGV4dC5tb3ZlID0gbnVsbDtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHQkZG9jdW1lbnQub24oIHRvdWNoTW92ZUV2ZW50LCBjb250ZXh0Lm1vdmUgKVxyXG5cdFx0XHRcdFx0Lm9uZSggdG91Y2hTdG9wRXZlbnQsIGNvbnRleHQuc3RvcCApO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHQkdGhpcy5vbiggdG91Y2hTdGFydEV2ZW50LCBjb250ZXh0LnN0YXJ0ICk7XHJcblx0XHR9LFxyXG5cclxuXHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIGV2ZW50cywgY29udGV4dDtcclxuXHJcblx0XHRcdGV2ZW50cyA9ICQuZGF0YSggdGhpcywgXCJtb2JpbGUtZXZlbnRzXCIgKTtcclxuXHRcdFx0aWYgKCBldmVudHMgKSB7XHJcblx0XHRcdFx0Y29udGV4dCA9IGV2ZW50cy5zd2lwZTtcclxuXHRcdFx0XHRkZWxldGUgZXZlbnRzLnN3aXBlO1xyXG5cdFx0XHRcdGV2ZW50cy5sZW5ndGgtLTtcclxuXHRcdFx0XHRpZiAoIGV2ZW50cy5sZW5ndGggPT09IDAgKSB7XHJcblx0XHRcdFx0XHQkLnJlbW92ZURhdGEoIHRoaXMsIFwibW9iaWxlLWV2ZW50c1wiICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGNvbnRleHQgKSB7XHJcblx0XHRcdFx0aWYgKCBjb250ZXh0LnN0YXJ0ICkge1xyXG5cdFx0XHRcdFx0JCggdGhpcyApLm9mZiggdG91Y2hTdGFydEV2ZW50LCBjb250ZXh0LnN0YXJ0ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggY29udGV4dC5tb3ZlICkge1xyXG5cdFx0XHRcdFx0JGRvY3VtZW50Lm9mZiggdG91Y2hNb3ZlRXZlbnQsIGNvbnRleHQubW92ZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGNvbnRleHQuc3RvcCApIHtcclxuXHRcdFx0XHRcdCRkb2N1bWVudC5vZmYoIHRvdWNoU3RvcEV2ZW50LCBjb250ZXh0LnN0b3AgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9O1xyXG5cdCQuZWFjaCh7XHJcblx0XHRzd2lwZWxlZnQ6IFwic3dpcGUubGVmdFwiLFxyXG5cdFx0c3dpcGVyaWdodDogXCJzd2lwZS5yaWdodFwiXHJcblx0fSwgZnVuY3Rpb24oIGV2ZW50LCBzb3VyY2VFdmVudCApIHtcclxuXHJcblx0XHQkLmV2ZW50LnNwZWNpYWxbIGV2ZW50IF0gPSB7XHJcblx0XHRcdHNldHVwOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHQkKCB0aGlzICkuYmluZCggc291cmNlRXZlbnQsICQubm9vcCApO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0JCggdGhpcyApLnVuYmluZCggc291cmNlRXZlbnQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9KTtcclxufSkoIGpRdWVyeSwgdGhpcyApO1xyXG4qL1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuY29uc3QgTXV0YXRpb25PYnNlcnZlciA9IChmdW5jdGlvbiAoKSB7XHJcbiAgdmFyIHByZWZpeGVzID0gWydXZWJLaXQnLCAnTW96JywgJ08nLCAnTXMnLCAnJ107XHJcbiAgZm9yICh2YXIgaT0wOyBpIDwgcHJlZml4ZXMubGVuZ3RoOyBpKyspIHtcclxuICAgIGlmIChgJHtwcmVmaXhlc1tpXX1NdXRhdGlvbk9ic2VydmVyYCBpbiB3aW5kb3cpIHtcclxuICAgICAgcmV0dXJuIHdpbmRvd1tgJHtwcmVmaXhlc1tpXX1NdXRhdGlvbk9ic2VydmVyYF07XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBmYWxzZTtcclxufSgpKTtcclxuXHJcbmNvbnN0IHRyaWdnZXJzID0gKGVsLCB0eXBlKSA9PiB7XHJcbiAgZWwuZGF0YSh0eXBlKS5zcGxpdCgnICcpLmZvckVhY2goaWQgPT4ge1xyXG4gICAgJChgIyR7aWR9YClbIHR5cGUgPT09ICdjbG9zZScgPyAndHJpZ2dlcicgOiAndHJpZ2dlckhhbmRsZXInXShgJHt0eXBlfS56Zi50cmlnZ2VyYCwgW2VsXSk7XHJcbiAgfSk7XHJcbn07XHJcbi8vIEVsZW1lbnRzIHdpdGggW2RhdGEtb3Blbl0gd2lsbCByZXZlYWwgYSBwbHVnaW4gdGhhdCBzdXBwb3J0cyBpdCB3aGVuIGNsaWNrZWQuXHJcbiQoZG9jdW1lbnQpLm9uKCdjbGljay56Zi50cmlnZ2VyJywgJ1tkYXRhLW9wZW5dJywgZnVuY3Rpb24oKSB7XHJcbiAgdHJpZ2dlcnMoJCh0aGlzKSwgJ29wZW4nKTtcclxufSk7XHJcblxyXG4vLyBFbGVtZW50cyB3aXRoIFtkYXRhLWNsb3NlXSB3aWxsIGNsb3NlIGEgcGx1Z2luIHRoYXQgc3VwcG9ydHMgaXQgd2hlbiBjbGlja2VkLlxyXG4vLyBJZiB1c2VkIHdpdGhvdXQgYSB2YWx1ZSBvbiBbZGF0YS1jbG9zZV0sIHRoZSBldmVudCB3aWxsIGJ1YmJsZSwgYWxsb3dpbmcgaXQgdG8gY2xvc2UgYSBwYXJlbnQgY29tcG9uZW50LlxyXG4kKGRvY3VtZW50KS5vbignY2xpY2suemYudHJpZ2dlcicsICdbZGF0YS1jbG9zZV0nLCBmdW5jdGlvbigpIHtcclxuICBsZXQgaWQgPSAkKHRoaXMpLmRhdGEoJ2Nsb3NlJyk7XHJcbiAgaWYgKGlkKSB7XHJcbiAgICB0cmlnZ2VycygkKHRoaXMpLCAnY2xvc2UnKTtcclxuICB9XHJcbiAgZWxzZSB7XHJcbiAgICAkKHRoaXMpLnRyaWdnZXIoJ2Nsb3NlLnpmLnRyaWdnZXInKTtcclxuICB9XHJcbn0pO1xyXG5cclxuLy8gRWxlbWVudHMgd2l0aCBbZGF0YS10b2dnbGVdIHdpbGwgdG9nZ2xlIGEgcGx1Z2luIHRoYXQgc3VwcG9ydHMgaXQgd2hlbiBjbGlja2VkLlxyXG4kKGRvY3VtZW50KS5vbignY2xpY2suemYudHJpZ2dlcicsICdbZGF0YS10b2dnbGVdJywgZnVuY3Rpb24oKSB7XHJcbiAgbGV0IGlkID0gJCh0aGlzKS5kYXRhKCd0b2dnbGUnKTtcclxuICBpZiAoaWQpIHtcclxuICAgIHRyaWdnZXJzKCQodGhpcyksICd0b2dnbGUnKTtcclxuICB9IGVsc2Uge1xyXG4gICAgJCh0aGlzKS50cmlnZ2VyKCd0b2dnbGUuemYudHJpZ2dlcicpO1xyXG4gIH1cclxufSk7XHJcblxyXG4vLyBFbGVtZW50cyB3aXRoIFtkYXRhLWNsb3NhYmxlXSB3aWxsIHJlc3BvbmQgdG8gY2xvc2UuemYudHJpZ2dlciBldmVudHMuXHJcbiQoZG9jdW1lbnQpLm9uKCdjbG9zZS56Zi50cmlnZ2VyJywgJ1tkYXRhLWNsb3NhYmxlXScsIGZ1bmN0aW9uKGUpe1xyXG4gIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgbGV0IGFuaW1hdGlvbiA9ICQodGhpcykuZGF0YSgnY2xvc2FibGUnKTtcclxuXHJcbiAgaWYoYW5pbWF0aW9uICE9PSAnJyl7XHJcbiAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlT3V0KCQodGhpcyksIGFuaW1hdGlvbiwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICQodGhpcykudHJpZ2dlcignY2xvc2VkLnpmJyk7XHJcbiAgICB9KTtcclxuICB9ZWxzZXtcclxuICAgICQodGhpcykuZmFkZU91dCgpLnRyaWdnZXIoJ2Nsb3NlZC56ZicpO1xyXG4gIH1cclxufSk7XHJcblxyXG4kKGRvY3VtZW50KS5vbignZm9jdXMuemYudHJpZ2dlciBibHVyLnpmLnRyaWdnZXInLCAnW2RhdGEtdG9nZ2xlLWZvY3VzXScsIGZ1bmN0aW9uKCkge1xyXG4gIGxldCBpZCA9ICQodGhpcykuZGF0YSgndG9nZ2xlLWZvY3VzJyk7XHJcbiAgJChgIyR7aWR9YCkudHJpZ2dlckhhbmRsZXIoJ3RvZ2dsZS56Zi50cmlnZ2VyJywgWyQodGhpcyldKTtcclxufSk7XHJcblxyXG4vKipcclxuKiBGaXJlcyBvbmNlIGFmdGVyIGFsbCBvdGhlciBzY3JpcHRzIGhhdmUgbG9hZGVkXHJcbiogQGZ1bmN0aW9uXHJcbiogQHByaXZhdGVcclxuKi9cclxuJCh3aW5kb3cpLm9uKCdsb2FkJywgKCkgPT4ge1xyXG4gIGNoZWNrTGlzdGVuZXJzKCk7XHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gY2hlY2tMaXN0ZW5lcnMoKSB7XHJcbiAgZXZlbnRzTGlzdGVuZXIoKTtcclxuICByZXNpemVMaXN0ZW5lcigpO1xyXG4gIHNjcm9sbExpc3RlbmVyKCk7XHJcbiAgbXV0YXRlTGlzdGVuZXIoKTtcclxuICBjbG9zZW1lTGlzdGVuZXIoKTtcclxufVxyXG5cclxuLy8qKioqKioqKiBvbmx5IGZpcmVzIHRoaXMgZnVuY3Rpb24gb25jZSBvbiBsb2FkLCBpZiB0aGVyZSdzIHNvbWV0aGluZyB0byB3YXRjaCAqKioqKioqKlxyXG5mdW5jdGlvbiBjbG9zZW1lTGlzdGVuZXIocGx1Z2luTmFtZSkge1xyXG4gIHZhciB5ZXRpQm94ZXMgPSAkKCdbZGF0YS15ZXRpLWJveF0nKSxcclxuICAgICAgcGx1Z05hbWVzID0gWydkcm9wZG93bicsICd0b29sdGlwJywgJ3JldmVhbCddO1xyXG5cclxuICBpZihwbHVnaW5OYW1lKXtcclxuICAgIGlmKHR5cGVvZiBwbHVnaW5OYW1lID09PSAnc3RyaW5nJyl7XHJcbiAgICAgIHBsdWdOYW1lcy5wdXNoKHBsdWdpbk5hbWUpO1xyXG4gICAgfWVsc2UgaWYodHlwZW9mIHBsdWdpbk5hbWUgPT09ICdvYmplY3QnICYmIHR5cGVvZiBwbHVnaW5OYW1lWzBdID09PSAnc3RyaW5nJyl7XHJcbiAgICAgIHBsdWdOYW1lcy5jb25jYXQocGx1Z2luTmFtZSk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgY29uc29sZS5lcnJvcignUGx1Z2luIG5hbWVzIG11c3QgYmUgc3RyaW5ncycpO1xyXG4gICAgfVxyXG4gIH1cclxuICBpZih5ZXRpQm94ZXMubGVuZ3RoKXtcclxuICAgIGxldCBsaXN0ZW5lcnMgPSBwbHVnTmFtZXMubWFwKChuYW1lKSA9PiB7XHJcbiAgICAgIHJldHVybiBgY2xvc2VtZS56Zi4ke25hbWV9YDtcclxuICAgIH0pLmpvaW4oJyAnKTtcclxuXHJcbiAgICAkKHdpbmRvdykub2ZmKGxpc3RlbmVycykub24obGlzdGVuZXJzLCBmdW5jdGlvbihlLCBwbHVnaW5JZCl7XHJcbiAgICAgIGxldCBwbHVnaW4gPSBlLm5hbWVzcGFjZS5zcGxpdCgnLicpWzBdO1xyXG4gICAgICBsZXQgcGx1Z2lucyA9ICQoYFtkYXRhLSR7cGx1Z2lufV1gKS5ub3QoYFtkYXRhLXlldGktYm94PVwiJHtwbHVnaW5JZH1cIl1gKTtcclxuXHJcbiAgICAgIHBsdWdpbnMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICAgIGxldCBfdGhpcyA9ICQodGhpcyk7XHJcblxyXG4gICAgICAgIF90aGlzLnRyaWdnZXJIYW5kbGVyKCdjbG9zZS56Zi50cmlnZ2VyJywgW190aGlzXSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiByZXNpemVMaXN0ZW5lcihkZWJvdW5jZSl7XHJcbiAgbGV0IHRpbWVyLFxyXG4gICAgICAkbm9kZXMgPSAkKCdbZGF0YS1yZXNpemVdJyk7XHJcbiAgaWYoJG5vZGVzLmxlbmd0aCl7XHJcbiAgICAkKHdpbmRvdykub2ZmKCdyZXNpemUuemYudHJpZ2dlcicpXHJcbiAgICAub24oJ3Jlc2l6ZS56Zi50cmlnZ2VyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZiAodGltZXIpIHsgY2xlYXJUaW1lb3V0KHRpbWVyKTsgfVxyXG5cclxuICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG4gICAgICAgIGlmKCFNdXRhdGlvbk9ic2VydmVyKXsvL2ZhbGxiYWNrIGZvciBJRSA5XHJcbiAgICAgICAgICAkbm9kZXMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAkKHRoaXMpLnRyaWdnZXJIYW5kbGVyKCdyZXNpemVtZS56Zi50cmlnZ2VyJyk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy90cmlnZ2VyIGFsbCBsaXN0ZW5pbmcgZWxlbWVudHMgYW5kIHNpZ25hbCBhIHJlc2l6ZSBldmVudFxyXG4gICAgICAgICRub2Rlcy5hdHRyKCdkYXRhLWV2ZW50cycsIFwicmVzaXplXCIpO1xyXG4gICAgICB9LCBkZWJvdW5jZSB8fCAxMCk7Ly9kZWZhdWx0IHRpbWUgdG8gZW1pdCByZXNpemUgZXZlbnRcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2Nyb2xsTGlzdGVuZXIoZGVib3VuY2Upe1xyXG4gIGxldCB0aW1lcixcclxuICAgICAgJG5vZGVzID0gJCgnW2RhdGEtc2Nyb2xsXScpO1xyXG4gIGlmKCRub2Rlcy5sZW5ndGgpe1xyXG4gICAgJCh3aW5kb3cpLm9mZignc2Nyb2xsLnpmLnRyaWdnZXInKVxyXG4gICAgLm9uKCdzY3JvbGwuemYudHJpZ2dlcicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICBpZih0aW1lcil7IGNsZWFyVGltZW91dCh0aW1lcik7IH1cclxuXHJcbiAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuICAgICAgICBpZighTXV0YXRpb25PYnNlcnZlcil7Ly9mYWxsYmFjayBmb3IgSUUgOVxyXG4gICAgICAgICAgJG5vZGVzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgJCh0aGlzKS50cmlnZ2VySGFuZGxlcignc2Nyb2xsbWUuemYudHJpZ2dlcicpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vdHJpZ2dlciBhbGwgbGlzdGVuaW5nIGVsZW1lbnRzIGFuZCBzaWduYWwgYSBzY3JvbGwgZXZlbnRcclxuICAgICAgICAkbm9kZXMuYXR0cignZGF0YS1ldmVudHMnLCBcInNjcm9sbFwiKTtcclxuICAgICAgfSwgZGVib3VuY2UgfHwgMTApOy8vZGVmYXVsdCB0aW1lIHRvIGVtaXQgc2Nyb2xsIGV2ZW50XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG11dGF0ZUxpc3RlbmVyKGRlYm91bmNlKSB7XHJcbiAgICBsZXQgJG5vZGVzID0gJCgnW2RhdGEtbXV0YXRlXScpO1xyXG4gICAgaWYgKCRub2Rlcy5sZW5ndGggJiYgTXV0YXRpb25PYnNlcnZlcil7XHJcblx0XHRcdC8vdHJpZ2dlciBhbGwgbGlzdGVuaW5nIGVsZW1lbnRzIGFuZCBzaWduYWwgYSBtdXRhdGUgZXZlbnRcclxuICAgICAgLy9ubyBJRSA5IG9yIDEwXHJcblx0XHRcdCRub2Rlcy5lYWNoKGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0ICAkKHRoaXMpLnRyaWdnZXJIYW5kbGVyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJyk7XHJcblx0XHRcdH0pO1xyXG4gICAgfVxyXG4gfVxyXG5cclxuZnVuY3Rpb24gZXZlbnRzTGlzdGVuZXIoKSB7XHJcbiAgaWYoIU11dGF0aW9uT2JzZXJ2ZXIpeyByZXR1cm4gZmFsc2U7IH1cclxuICBsZXQgbm9kZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1yZXNpemVdLCBbZGF0YS1zY3JvbGxdLCBbZGF0YS1tdXRhdGVdJyk7XHJcblxyXG4gIC8vZWxlbWVudCBjYWxsYmFja1xyXG4gIHZhciBsaXN0ZW5pbmdFbGVtZW50c011dGF0aW9uID0gZnVuY3Rpb24gKG11dGF0aW9uUmVjb3Jkc0xpc3QpIHtcclxuICAgICAgdmFyICR0YXJnZXQgPSAkKG11dGF0aW9uUmVjb3Jkc0xpc3RbMF0udGFyZ2V0KTtcclxuXHJcblx0ICAvL3RyaWdnZXIgdGhlIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBlbGVtZW50IGRlcGVuZGluZyBvbiB0eXBlXHJcbiAgICAgIHN3aXRjaCAobXV0YXRpb25SZWNvcmRzTGlzdFswXS50eXBlKSB7XHJcblxyXG4gICAgICAgIGNhc2UgXCJhdHRyaWJ1dGVzXCI6XHJcbiAgICAgICAgICBpZiAoJHRhcmdldC5hdHRyKFwiZGF0YS1ldmVudHNcIikgPT09IFwic2Nyb2xsXCIgJiYgbXV0YXRpb25SZWNvcmRzTGlzdFswXS5hdHRyaWJ1dGVOYW1lID09PSBcImRhdGEtZXZlbnRzXCIpIHtcclxuXHRcdCAgXHQkdGFyZ2V0LnRyaWdnZXJIYW5kbGVyKCdzY3JvbGxtZS56Zi50cmlnZ2VyJywgWyR0YXJnZXQsIHdpbmRvdy5wYWdlWU9mZnNldF0pO1xyXG5cdFx0ICB9XHJcblx0XHQgIGlmICgkdGFyZ2V0LmF0dHIoXCJkYXRhLWV2ZW50c1wiKSA9PT0gXCJyZXNpemVcIiAmJiBtdXRhdGlvblJlY29yZHNMaXN0WzBdLmF0dHJpYnV0ZU5hbWUgPT09IFwiZGF0YS1ldmVudHNcIikge1xyXG5cdFx0ICBcdCR0YXJnZXQudHJpZ2dlckhhbmRsZXIoJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInLCBbJHRhcmdldF0pO1xyXG5cdFx0ICAgfVxyXG5cdFx0ICBpZiAobXV0YXRpb25SZWNvcmRzTGlzdFswXS5hdHRyaWJ1dGVOYW1lID09PSBcInN0eWxlXCIpIHtcclxuXHRcdFx0ICAkdGFyZ2V0LmNsb3Nlc3QoXCJbZGF0YS1tdXRhdGVdXCIpLmF0dHIoXCJkYXRhLWV2ZW50c1wiLFwibXV0YXRlXCIpO1xyXG5cdFx0XHQgICR0YXJnZXQuY2xvc2VzdChcIltkYXRhLW11dGF0ZV1cIikudHJpZ2dlckhhbmRsZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInLCBbJHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtbXV0YXRlXVwiKV0pO1xyXG5cdFx0ICB9XHJcblx0XHQgIGJyZWFrO1xyXG5cclxuICAgICAgICBjYXNlIFwiY2hpbGRMaXN0XCI6XHJcblx0XHQgICR0YXJnZXQuY2xvc2VzdChcIltkYXRhLW11dGF0ZV1cIikuYXR0cihcImRhdGEtZXZlbnRzXCIsXCJtdXRhdGVcIik7XHJcblx0XHQgICR0YXJnZXQuY2xvc2VzdChcIltkYXRhLW11dGF0ZV1cIikudHJpZ2dlckhhbmRsZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInLCBbJHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtbXV0YXRlXVwiKV0pO1xyXG4gICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgLy9ub3RoaW5nXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgaWYgKG5vZGVzLmxlbmd0aCkge1xyXG4gICAgICAvL2ZvciBlYWNoIGVsZW1lbnQgdGhhdCBuZWVkcyB0byBsaXN0ZW4gZm9yIHJlc2l6aW5nLCBzY3JvbGxpbmcsIG9yIG11dGF0aW9uIGFkZCBhIHNpbmdsZSBvYnNlcnZlclxyXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8PSBub2Rlcy5sZW5ndGggLSAxOyBpKyspIHtcclxuICAgICAgICB2YXIgZWxlbWVudE9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIobGlzdGVuaW5nRWxlbWVudHNNdXRhdGlvbik7XHJcbiAgICAgICAgZWxlbWVudE9ic2VydmVyLm9ic2VydmUobm9kZXNbaV0sIHsgYXR0cmlidXRlczogdHJ1ZSwgY2hpbGRMaXN0OiB0cnVlLCBjaGFyYWN0ZXJEYXRhOiBmYWxzZSwgc3VidHJlZTogdHJ1ZSwgYXR0cmlidXRlRmlsdGVyOiBbXCJkYXRhLWV2ZW50c1wiLCBcInN0eWxlXCJdIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vLyBbUEhdXHJcbi8vIEZvdW5kYXRpb24uQ2hlY2tXYXRjaGVycyA9IGNoZWNrV2F0Y2hlcnM7XHJcbkZvdW5kYXRpb24uSUhlYXJZb3UgPSBjaGVja0xpc3RlbmVycztcclxuLy8gRm91bmRhdGlvbi5JU2VlWW91ID0gc2Nyb2xsTGlzdGVuZXI7XHJcbi8vIEZvdW5kYXRpb24uSUZlZWxZb3UgPSBjbG9zZW1lTGlzdGVuZXI7XHJcblxyXG59KGpRdWVyeSk7XHJcblxyXG4vLyBmdW5jdGlvbiBkb21NdXRhdGlvbk9ic2VydmVyKGRlYm91bmNlKSB7XHJcbi8vICAgLy8gISEhIFRoaXMgaXMgY29taW5nIHNvb24gYW5kIG5lZWRzIG1vcmUgd29yazsgbm90IGFjdGl2ZSAgISEhIC8vXHJcbi8vICAgdmFyIHRpbWVyLFxyXG4vLyAgIG5vZGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbXV0YXRlXScpO1xyXG4vLyAgIC8vXHJcbi8vICAgaWYgKG5vZGVzLmxlbmd0aCkge1xyXG4vLyAgICAgLy8gdmFyIE11dGF0aW9uT2JzZXJ2ZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4vLyAgICAgLy8gICB2YXIgcHJlZml4ZXMgPSBbJ1dlYktpdCcsICdNb3onLCAnTycsICdNcycsICcnXTtcclxuLy8gICAgIC8vICAgZm9yICh2YXIgaT0wOyBpIDwgcHJlZml4ZXMubGVuZ3RoOyBpKyspIHtcclxuLy8gICAgIC8vICAgICBpZiAocHJlZml4ZXNbaV0gKyAnTXV0YXRpb25PYnNlcnZlcicgaW4gd2luZG93KSB7XHJcbi8vICAgICAvLyAgICAgICByZXR1cm4gd2luZG93W3ByZWZpeGVzW2ldICsgJ011dGF0aW9uT2JzZXJ2ZXInXTtcclxuLy8gICAgIC8vICAgICB9XHJcbi8vICAgICAvLyAgIH1cclxuLy8gICAgIC8vICAgcmV0dXJuIGZhbHNlO1xyXG4vLyAgICAgLy8gfSgpKTtcclxuLy9cclxuLy9cclxuLy8gICAgIC8vZm9yIHRoZSBib2R5LCB3ZSBuZWVkIHRvIGxpc3RlbiBmb3IgYWxsIGNoYW5nZXMgZWZmZWN0aW5nIHRoZSBzdHlsZSBhbmQgY2xhc3MgYXR0cmlidXRlc1xyXG4vLyAgICAgdmFyIGJvZHlPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGJvZHlNdXRhdGlvbik7XHJcbi8vICAgICBib2R5T2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGF0dHJpYnV0ZXM6IHRydWUsIGNoaWxkTGlzdDogdHJ1ZSwgY2hhcmFjdGVyRGF0YTogZmFsc2UsIHN1YnRyZWU6dHJ1ZSwgYXR0cmlidXRlRmlsdGVyOltcInN0eWxlXCIsIFwiY2xhc3NcIl19KTtcclxuLy9cclxuLy9cclxuLy8gICAgIC8vYm9keSBjYWxsYmFja1xyXG4vLyAgICAgZnVuY3Rpb24gYm9keU11dGF0aW9uKG11dGF0ZSkge1xyXG4vLyAgICAgICAvL3RyaWdnZXIgYWxsIGxpc3RlbmluZyBlbGVtZW50cyBhbmQgc2lnbmFsIGEgbXV0YXRpb24gZXZlbnRcclxuLy8gICAgICAgaWYgKHRpbWVyKSB7IGNsZWFyVGltZW91dCh0aW1lcik7IH1cclxuLy9cclxuLy8gICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4vLyAgICAgICAgIGJvZHlPYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcbi8vICAgICAgICAgJCgnW2RhdGEtbXV0YXRlXScpLmF0dHIoJ2RhdGEtZXZlbnRzJyxcIm11dGF0ZVwiKTtcclxuLy8gICAgICAgfSwgZGVib3VuY2UgfHwgMTUwKTtcclxuLy8gICAgIH1cclxuLy8gICB9XHJcbi8vIH1cclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBBYmlkZSBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5hYmlkZVxyXG4gKi9cclxuXHJcbmNsYXNzIEFiaWRlIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIEFiaWRlLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBBYmlkZSNpbml0XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGFkZCB0aGUgdHJpZ2dlciB0by5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyAgPSAkLmV4dGVuZCh7fSwgQWJpZGUuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnQWJpZGUnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBBYmlkZSBwbHVnaW4gYW5kIGNhbGxzIGZ1bmN0aW9ucyB0byBnZXQgQWJpZGUgZnVuY3Rpb25pbmcgb24gbG9hZC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdGhpcy4kaW5wdXRzID0gdGhpcy4kZWxlbWVudC5maW5kKCdpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcpO1xyXG5cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgZXZlbnRzIGZvciBBYmlkZS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLmFiaWRlJylcclxuICAgICAgLm9uKCdyZXNldC56Zi5hYmlkZScsICgpID0+IHtcclxuICAgICAgICB0aGlzLnJlc2V0Rm9ybSgpO1xyXG4gICAgICB9KVxyXG4gICAgICAub24oJ3N1Ym1pdC56Zi5hYmlkZScsICgpID0+IHtcclxuICAgICAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUZvcm0oKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy52YWxpZGF0ZU9uID09PSAnZmllbGRDaGFuZ2UnKSB7XHJcbiAgICAgIHRoaXMuJGlucHV0c1xyXG4gICAgICAgIC5vZmYoJ2NoYW5nZS56Zi5hYmlkZScpXHJcbiAgICAgICAgLm9uKCdjaGFuZ2UuemYuYWJpZGUnLCAoZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy52YWxpZGF0ZUlucHV0KCQoZS50YXJnZXQpKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmxpdmVWYWxpZGF0ZSkge1xyXG4gICAgICB0aGlzLiRpbnB1dHNcclxuICAgICAgICAub2ZmKCdpbnB1dC56Zi5hYmlkZScpXHJcbiAgICAgICAgLm9uKCdpbnB1dC56Zi5hYmlkZScsIChlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZhbGlkYXRlSW5wdXQoJChlLnRhcmdldCkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudmFsaWRhdGVPbkJsdXIpIHtcclxuICAgICAgdGhpcy4kaW5wdXRzXHJcbiAgICAgICAgLm9mZignYmx1ci56Zi5hYmlkZScpXHJcbiAgICAgICAgLm9uKCdibHVyLnpmLmFiaWRlJywgKGUpID0+IHtcclxuICAgICAgICAgIHRoaXMudmFsaWRhdGVJbnB1dCgkKGUudGFyZ2V0KSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxscyBuZWNlc3NhcnkgZnVuY3Rpb25zIHRvIHVwZGF0ZSBBYmlkZSB1cG9uIERPTSBjaGFuZ2VcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9yZWZsb3coKSB7XHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3Mgd2hldGhlciBvciBub3QgYSBmb3JtIGVsZW1lbnQgaGFzIHRoZSByZXF1aXJlZCBhdHRyaWJ1dGUgYW5kIGlmIGl0J3MgY2hlY2tlZCBvciBub3RcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gY2hlY2sgZm9yIHJlcXVpcmVkIGF0dHJpYnV0ZVxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBCb29sZWFuIHZhbHVlIGRlcGVuZHMgb24gd2hldGhlciBvciBub3QgYXR0cmlidXRlIGlzIGNoZWNrZWQgb3IgZW1wdHlcclxuICAgKi9cclxuICByZXF1aXJlZENoZWNrKCRlbCkge1xyXG4gICAgaWYgKCEkZWwuYXR0cigncmVxdWlyZWQnKSkgcmV0dXJuIHRydWU7XHJcblxyXG4gICAgdmFyIGlzR29vZCA9IHRydWU7XHJcblxyXG4gICAgc3dpdGNoICgkZWxbMF0udHlwZSkge1xyXG4gICAgICBjYXNlICdjaGVja2JveCc6XHJcbiAgICAgICAgaXNHb29kID0gJGVsWzBdLmNoZWNrZWQ7XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlICdzZWxlY3QnOlxyXG4gICAgICBjYXNlICdzZWxlY3Qtb25lJzpcclxuICAgICAgY2FzZSAnc2VsZWN0LW11bHRpcGxlJzpcclxuICAgICAgICB2YXIgb3B0ID0gJGVsLmZpbmQoJ29wdGlvbjpzZWxlY3RlZCcpO1xyXG4gICAgICAgIGlmICghb3B0Lmxlbmd0aCB8fCAhb3B0LnZhbCgpKSBpc0dvb2QgPSBmYWxzZTtcclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgaWYoISRlbC52YWwoKSB8fCAhJGVsLnZhbCgpLmxlbmd0aCkgaXNHb29kID0gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGlzR29vZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJhc2VkIG9uICRlbCwgZ2V0IHRoZSBmaXJzdCBlbGVtZW50IHdpdGggc2VsZWN0b3IgaW4gdGhpcyBvcmRlcjpcclxuICAgKiAxLiBUaGUgZWxlbWVudCdzIGRpcmVjdCBzaWJsaW5nKCdzKS5cclxuICAgKiAzLiBUaGUgZWxlbWVudCdzIHBhcmVudCdzIGNoaWxkcmVuLlxyXG4gICAqXHJcbiAgICogVGhpcyBhbGxvd3MgZm9yIG11bHRpcGxlIGZvcm0gZXJyb3JzIHBlciBpbnB1dCwgdGhvdWdoIGlmIG5vbmUgYXJlIGZvdW5kLCBubyBmb3JtIGVycm9ycyB3aWxsIGJlIHNob3duLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHtPYmplY3R9ICRlbCAtIGpRdWVyeSBvYmplY3QgdG8gdXNlIGFzIHJlZmVyZW5jZSB0byBmaW5kIHRoZSBmb3JtIGVycm9yIHNlbGVjdG9yLlxyXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IGpRdWVyeSBvYmplY3Qgd2l0aCB0aGUgc2VsZWN0b3IuXHJcbiAgICovXHJcbiAgZmluZEZvcm1FcnJvcigkZWwpIHtcclxuICAgIHZhciAkZXJyb3IgPSAkZWwuc2libGluZ3ModGhpcy5vcHRpb25zLmZvcm1FcnJvclNlbGVjdG9yKTtcclxuXHJcbiAgICBpZiAoISRlcnJvci5sZW5ndGgpIHtcclxuICAgICAgJGVycm9yID0gJGVsLnBhcmVudCgpLmZpbmQodGhpcy5vcHRpb25zLmZvcm1FcnJvclNlbGVjdG9yKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gJGVycm9yO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBmaXJzdCBlbGVtZW50IGluIHRoaXMgb3JkZXI6XHJcbiAgICogMi4gVGhlIDxsYWJlbD4gd2l0aCB0aGUgYXR0cmlidXRlIGBbZm9yPVwic29tZUlucHV0SWRcIl1gXHJcbiAgICogMy4gVGhlIGAuY2xvc2VzdCgpYCA8bGFiZWw+XHJcbiAgICpcclxuICAgKiBAcGFyYW0ge09iamVjdH0gJGVsIC0galF1ZXJ5IG9iamVjdCB0byBjaGVjayBmb3IgcmVxdWlyZWQgYXR0cmlidXRlXHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IEJvb2xlYW4gdmFsdWUgZGVwZW5kcyBvbiB3aGV0aGVyIG9yIG5vdCBhdHRyaWJ1dGUgaXMgY2hlY2tlZCBvciBlbXB0eVxyXG4gICAqL1xyXG4gIGZpbmRMYWJlbCgkZWwpIHtcclxuICAgIHZhciBpZCA9ICRlbFswXS5pZDtcclxuICAgIHZhciAkbGFiZWwgPSB0aGlzLiRlbGVtZW50LmZpbmQoYGxhYmVsW2Zvcj1cIiR7aWR9XCJdYCk7XHJcblxyXG4gICAgaWYgKCEkbGFiZWwubGVuZ3RoKSB7XHJcbiAgICAgIHJldHVybiAkZWwuY2xvc2VzdCgnbGFiZWwnKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gJGxhYmVsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBzZXQgb2YgbGFiZWxzIGFzc29jaWF0ZWQgd2l0aCBhIHNldCBvZiByYWRpbyBlbHMgaW4gdGhpcyBvcmRlclxyXG4gICAqIDIuIFRoZSA8bGFiZWw+IHdpdGggdGhlIGF0dHJpYnV0ZSBgW2Zvcj1cInNvbWVJbnB1dElkXCJdYFxyXG4gICAqIDMuIFRoZSBgLmNsb3Nlc3QoKWAgPGxhYmVsPlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHtPYmplY3R9ICRlbCAtIGpRdWVyeSBvYmplY3QgdG8gY2hlY2sgZm9yIHJlcXVpcmVkIGF0dHJpYnV0ZVxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBCb29sZWFuIHZhbHVlIGRlcGVuZHMgb24gd2hldGhlciBvciBub3QgYXR0cmlidXRlIGlzIGNoZWNrZWQgb3IgZW1wdHlcclxuICAgKi9cclxuICBmaW5kUmFkaW9MYWJlbHMoJGVscykge1xyXG4gICAgdmFyIGxhYmVscyA9ICRlbHMubWFwKChpLCBlbCkgPT4ge1xyXG4gICAgICB2YXIgaWQgPSBlbC5pZDtcclxuICAgICAgdmFyICRsYWJlbCA9IHRoaXMuJGVsZW1lbnQuZmluZChgbGFiZWxbZm9yPVwiJHtpZH1cIl1gKTtcclxuXHJcbiAgICAgIGlmICghJGxhYmVsLmxlbmd0aCkge1xyXG4gICAgICAgICRsYWJlbCA9ICQoZWwpLmNsb3Nlc3QoJ2xhYmVsJyk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuICRsYWJlbFswXTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiAkKGxhYmVscyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIHRoZSBDU1MgZXJyb3IgY2xhc3MgYXMgc3BlY2lmaWVkIGJ5IHRoZSBBYmlkZSBzZXR0aW5ncyB0byB0aGUgbGFiZWwsIGlucHV0LCBhbmQgdGhlIGZvcm1cclxuICAgKiBAcGFyYW0ge09iamVjdH0gJGVsIC0galF1ZXJ5IG9iamVjdCB0byBhZGQgdGhlIGNsYXNzIHRvXHJcbiAgICovXHJcbiAgYWRkRXJyb3JDbGFzc2VzKCRlbCkge1xyXG4gICAgdmFyICRsYWJlbCA9IHRoaXMuZmluZExhYmVsKCRlbCk7XHJcbiAgICB2YXIgJGZvcm1FcnJvciA9IHRoaXMuZmluZEZvcm1FcnJvcigkZWwpO1xyXG5cclxuICAgIGlmICgkbGFiZWwubGVuZ3RoKSB7XHJcbiAgICAgICRsYWJlbC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMubGFiZWxFcnJvckNsYXNzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGZvcm1FcnJvci5sZW5ndGgpIHtcclxuICAgICAgJGZvcm1FcnJvci5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuZm9ybUVycm9yQ2xhc3MpO1xyXG4gICAgfVxyXG5cclxuICAgICRlbC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuaW5wdXRFcnJvckNsYXNzKS5hdHRyKCdkYXRhLWludmFsaWQnLCAnJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmUgQ1NTIGVycm9yIGNsYXNzZXMgZXRjIGZyb20gYW4gZW50aXJlIHJhZGlvIGJ1dHRvbiBncm91cFxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBncm91cE5hbWUgLSBBIHN0cmluZyB0aGF0IHNwZWNpZmllcyB0aGUgbmFtZSBvZiBhIHJhZGlvIGJ1dHRvbiBncm91cFxyXG4gICAqXHJcbiAgICovXHJcblxyXG4gIHJlbW92ZVJhZGlvRXJyb3JDbGFzc2VzKGdyb3VwTmFtZSkge1xyXG4gICAgdmFyICRlbHMgPSB0aGlzLiRlbGVtZW50LmZpbmQoYDpyYWRpb1tuYW1lPVwiJHtncm91cE5hbWV9XCJdYCk7XHJcbiAgICB2YXIgJGxhYmVscyA9IHRoaXMuZmluZFJhZGlvTGFiZWxzKCRlbHMpO1xyXG4gICAgdmFyICRmb3JtRXJyb3JzID0gdGhpcy5maW5kRm9ybUVycm9yKCRlbHMpO1xyXG5cclxuICAgIGlmICgkbGFiZWxzLmxlbmd0aCkge1xyXG4gICAgICAkbGFiZWxzLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sYWJlbEVycm9yQ2xhc3MpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgkZm9ybUVycm9ycy5sZW5ndGgpIHtcclxuICAgICAgJGZvcm1FcnJvcnMucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmZvcm1FcnJvckNsYXNzKTtcclxuICAgIH1cclxuXHJcbiAgICAkZWxzLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5pbnB1dEVycm9yQ2xhc3MpLnJlbW92ZUF0dHIoJ2RhdGEtaW52YWxpZCcpO1xyXG5cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMgQ1NTIGVycm9yIGNsYXNzIGFzIHNwZWNpZmllZCBieSB0aGUgQWJpZGUgc2V0dGluZ3MgZnJvbSB0aGUgbGFiZWwsIGlucHV0LCBhbmQgdGhlIGZvcm1cclxuICAgKiBAcGFyYW0ge09iamVjdH0gJGVsIC0galF1ZXJ5IG9iamVjdCB0byByZW1vdmUgdGhlIGNsYXNzIGZyb21cclxuICAgKi9cclxuICByZW1vdmVFcnJvckNsYXNzZXMoJGVsKSB7XHJcbiAgICAvLyByYWRpb3MgbmVlZCB0byBjbGVhciBhbGwgb2YgdGhlIGVsc1xyXG4gICAgaWYoJGVsWzBdLnR5cGUgPT0gJ3JhZGlvJykge1xyXG4gICAgICByZXR1cm4gdGhpcy5yZW1vdmVSYWRpb0Vycm9yQ2xhc3NlcygkZWwuYXR0cignbmFtZScpKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgJGxhYmVsID0gdGhpcy5maW5kTGFiZWwoJGVsKTtcclxuICAgIHZhciAkZm9ybUVycm9yID0gdGhpcy5maW5kRm9ybUVycm9yKCRlbCk7XHJcblxyXG4gICAgaWYgKCRsYWJlbC5sZW5ndGgpIHtcclxuICAgICAgJGxhYmVsLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sYWJlbEVycm9yQ2xhc3MpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgkZm9ybUVycm9yLmxlbmd0aCkge1xyXG4gICAgICAkZm9ybUVycm9yLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5mb3JtRXJyb3JDbGFzcyk7XHJcbiAgICB9XHJcblxyXG4gICAgJGVsLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5pbnB1dEVycm9yQ2xhc3MpLnJlbW92ZUF0dHIoJ2RhdGEtaW52YWxpZCcpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR29lcyB0aHJvdWdoIGEgZm9ybSB0byBmaW5kIGlucHV0cyBhbmQgcHJvY2VlZHMgdG8gdmFsaWRhdGUgdGhlbSBpbiB3YXlzIHNwZWNpZmljIHRvIHRoZWlyIHR5cGVcclxuICAgKiBAZmlyZXMgQWJpZGUjaW52YWxpZFxyXG4gICAqIEBmaXJlcyBBYmlkZSN2YWxpZFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byB2YWxpZGF0ZSwgc2hvdWxkIGJlIGFuIEhUTUwgaW5wdXRcclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gZ29vZFRvR28gLSBJZiB0aGUgaW5wdXQgaXMgdmFsaWQgb3Igbm90LlxyXG4gICAqL1xyXG4gIHZhbGlkYXRlSW5wdXQoJGVsKSB7XHJcbiAgICB2YXIgY2xlYXJSZXF1aXJlID0gdGhpcy5yZXF1aXJlZENoZWNrKCRlbCksXHJcbiAgICAgICAgdmFsaWRhdGVkID0gZmFsc2UsXHJcbiAgICAgICAgY3VzdG9tVmFsaWRhdG9yID0gdHJ1ZSxcclxuICAgICAgICB2YWxpZGF0b3IgPSAkZWwuYXR0cignZGF0YS12YWxpZGF0b3InKSxcclxuICAgICAgICBlcXVhbFRvID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBkb24ndCB2YWxpZGF0ZSBpZ25vcmVkIGlucHV0cyBvciBoaWRkZW4gaW5wdXRzXHJcbiAgICBpZiAoJGVsLmlzKCdbZGF0YS1hYmlkZS1pZ25vcmVdJykgfHwgJGVsLmlzKCdbdHlwZT1cImhpZGRlblwiXScpKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAoJGVsWzBdLnR5cGUpIHtcclxuICAgICAgY2FzZSAncmFkaW8nOlxyXG4gICAgICAgIHZhbGlkYXRlZCA9IHRoaXMudmFsaWRhdGVSYWRpbygkZWwuYXR0cignbmFtZScpKTtcclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGNhc2UgJ2NoZWNrYm94JzpcclxuICAgICAgICB2YWxpZGF0ZWQgPSBjbGVhclJlcXVpcmU7XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlICdzZWxlY3QnOlxyXG4gICAgICBjYXNlICdzZWxlY3Qtb25lJzpcclxuICAgICAgY2FzZSAnc2VsZWN0LW11bHRpcGxlJzpcclxuICAgICAgICB2YWxpZGF0ZWQgPSBjbGVhclJlcXVpcmU7XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHZhbGlkYXRlZCA9IHRoaXMudmFsaWRhdGVUZXh0KCRlbCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHZhbGlkYXRvcikge1xyXG4gICAgICBjdXN0b21WYWxpZGF0b3IgPSB0aGlzLm1hdGNoVmFsaWRhdGlvbigkZWwsIHZhbGlkYXRvciwgJGVsLmF0dHIoJ3JlcXVpcmVkJykpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgkZWwuYXR0cignZGF0YS1lcXVhbHRvJykpIHtcclxuICAgICAgZXF1YWxUbyA9IHRoaXMub3B0aW9ucy52YWxpZGF0b3JzLmVxdWFsVG8oJGVsKTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgdmFyIGdvb2RUb0dvID0gW2NsZWFyUmVxdWlyZSwgdmFsaWRhdGVkLCBjdXN0b21WYWxpZGF0b3IsIGVxdWFsVG9dLmluZGV4T2YoZmFsc2UpID09PSAtMTtcclxuICAgIHZhciBtZXNzYWdlID0gKGdvb2RUb0dvID8gJ3ZhbGlkJyA6ICdpbnZhbGlkJykgKyAnLnpmLmFiaWRlJztcclxuXHJcbiAgICBpZiAoZ29vZFRvR28pIHtcclxuICAgICAgLy8gUmUtdmFsaWRhdGUgaW5wdXRzIHRoYXQgZGVwZW5kIG9uIHRoaXMgb25lIHdpdGggZXF1YWx0b1xyXG4gICAgICBjb25zdCBkZXBlbmRlbnRFbGVtZW50cyA9IHRoaXMuJGVsZW1lbnQuZmluZChgW2RhdGEtZXF1YWx0bz1cIiR7JGVsLmF0dHIoJ2lkJyl9XCJdYCk7XHJcbiAgICAgIGlmIChkZXBlbmRlbnRFbGVtZW50cy5sZW5ndGgpIHtcclxuICAgICAgICBsZXQgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIGRlcGVuZGVudEVsZW1lbnRzLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoJCh0aGlzKS52YWwoKSkge1xyXG4gICAgICAgICAgICBfdGhpcy52YWxpZGF0ZUlucHV0KCQodGhpcykpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpc1tnb29kVG9HbyA/ICdyZW1vdmVFcnJvckNsYXNzZXMnIDogJ2FkZEVycm9yQ2xhc3NlcyddKCRlbCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBpbnB1dCBpcyBkb25lIGNoZWNraW5nIGZvciB2YWxpZGF0aW9uLiBFdmVudCB0cmlnZ2VyIGlzIGVpdGhlciBgdmFsaWQuemYuYWJpZGVgIG9yIGBpbnZhbGlkLnpmLmFiaWRlYFxyXG4gICAgICogVHJpZ2dlciBpbmNsdWRlcyB0aGUgRE9NIGVsZW1lbnQgb2YgdGhlIGlucHV0LlxyXG4gICAgICogQGV2ZW50IEFiaWRlI3ZhbGlkXHJcbiAgICAgKiBAZXZlbnQgQWJpZGUjaW52YWxpZFxyXG4gICAgICovXHJcbiAgICAkZWwudHJpZ2dlcihtZXNzYWdlLCBbJGVsXSk7XHJcblxyXG4gICAgcmV0dXJuIGdvb2RUb0dvO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR29lcyB0aHJvdWdoIGEgZm9ybSBhbmQgaWYgdGhlcmUgYXJlIGFueSBpbnZhbGlkIGlucHV0cywgaXQgd2lsbCBkaXNwbGF5IHRoZSBmb3JtIGVycm9yIGVsZW1lbnRcclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gbm9FcnJvciAtIHRydWUgaWYgbm8gZXJyb3JzIHdlcmUgZGV0ZWN0ZWQuLi5cclxuICAgKiBAZmlyZXMgQWJpZGUjZm9ybXZhbGlkXHJcbiAgICogQGZpcmVzIEFiaWRlI2Zvcm1pbnZhbGlkXHJcbiAgICovXHJcbiAgdmFsaWRhdGVGb3JtKCkge1xyXG4gICAgdmFyIGFjYyA9IFtdO1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiRpbnB1dHMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgYWNjLnB1c2goX3RoaXMudmFsaWRhdGVJbnB1dCgkKHRoaXMpKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgbm9FcnJvciA9IGFjYy5pbmRleE9mKGZhbHNlKSA9PT0gLTE7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1hYmlkZS1lcnJvcl0nKS5jc3MoJ2Rpc3BsYXknLCAobm9FcnJvciA/ICdub25lJyA6ICdibG9jaycpKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIGZvcm0gaXMgZmluaXNoZWQgdmFsaWRhdGluZy4gRXZlbnQgdHJpZ2dlciBpcyBlaXRoZXIgYGZvcm12YWxpZC56Zi5hYmlkZWAgb3IgYGZvcm1pbnZhbGlkLnpmLmFiaWRlYC5cclxuICAgICAqIFRyaWdnZXIgaW5jbHVkZXMgdGhlIGVsZW1lbnQgb2YgdGhlIGZvcm0uXHJcbiAgICAgKiBAZXZlbnQgQWJpZGUjZm9ybXZhbGlkXHJcbiAgICAgKiBAZXZlbnQgQWJpZGUjZm9ybWludmFsaWRcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKChub0Vycm9yID8gJ2Zvcm12YWxpZCcgOiAnZm9ybWludmFsaWQnKSArICcuemYuYWJpZGUnLCBbdGhpcy4kZWxlbWVudF0pO1xyXG5cclxuICAgIHJldHVybiBub0Vycm9yO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIG9yIGEgbm90IGEgdGV4dCBpbnB1dCBpcyB2YWxpZCBiYXNlZCBvbiB0aGUgcGF0dGVybiBzcGVjaWZpZWQgaW4gdGhlIGF0dHJpYnV0ZS4gSWYgbm8gbWF0Y2hpbmcgcGF0dGVybiBpcyBmb3VuZCwgcmV0dXJucyB0cnVlLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAkZWwgLSBqUXVlcnkgb2JqZWN0IHRvIHZhbGlkYXRlLCBzaG91bGQgYmUgYSB0ZXh0IGlucHV0IEhUTUwgZWxlbWVudFxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwYXR0ZXJuIC0gc3RyaW5nIHZhbHVlIG9mIG9uZSBvZiB0aGUgUmVnRXggcGF0dGVybnMgaW4gQWJpZGUub3B0aW9ucy5wYXR0ZXJuc1xyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBCb29sZWFuIHZhbHVlIGRlcGVuZHMgb24gd2hldGhlciBvciBub3QgdGhlIGlucHV0IHZhbHVlIG1hdGNoZXMgdGhlIHBhdHRlcm4gc3BlY2lmaWVkXHJcbiAgICovXHJcbiAgdmFsaWRhdGVUZXh0KCRlbCwgcGF0dGVybikge1xyXG4gICAgLy8gQSBwYXR0ZXJuIGNhbiBiZSBwYXNzZWQgdG8gdGhpcyBmdW5jdGlvbiwgb3IgaXQgd2lsbCBiZSBpbmZlcmVkIGZyb20gdGhlIGlucHV0J3MgXCJwYXR0ZXJuXCIgYXR0cmlidXRlLCBvciBpdCdzIFwidHlwZVwiIGF0dHJpYnV0ZVxyXG4gICAgcGF0dGVybiA9IChwYXR0ZXJuIHx8ICRlbC5hdHRyKCdwYXR0ZXJuJykgfHwgJGVsLmF0dHIoJ3R5cGUnKSk7XHJcbiAgICB2YXIgaW5wdXRUZXh0ID0gJGVsLnZhbCgpO1xyXG4gICAgdmFyIHZhbGlkID0gZmFsc2U7XHJcblxyXG4gICAgaWYgKGlucHV0VGV4dC5sZW5ndGgpIHtcclxuICAgICAgLy8gSWYgdGhlIHBhdHRlcm4gYXR0cmlidXRlIG9uIHRoZSBlbGVtZW50IGlzIGluIEFiaWRlJ3MgbGlzdCBvZiBwYXR0ZXJucywgdGhlbiB0ZXN0IHRoYXQgcmVnZXhwXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMucGF0dGVybnMuaGFzT3duUHJvcGVydHkocGF0dGVybikpIHtcclxuICAgICAgICB2YWxpZCA9IHRoaXMub3B0aW9ucy5wYXR0ZXJuc1twYXR0ZXJuXS50ZXN0KGlucHV0VGV4dCk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gSWYgdGhlIHBhdHRlcm4gbmFtZSBpc24ndCBhbHNvIHRoZSB0eXBlIGF0dHJpYnV0ZSBvZiB0aGUgZmllbGQsIHRoZW4gdGVzdCBpdCBhcyBhIHJlZ2V4cFxyXG4gICAgICBlbHNlIGlmIChwYXR0ZXJuICE9PSAkZWwuYXR0cigndHlwZScpKSB7XHJcbiAgICAgICAgdmFsaWQgPSBuZXcgUmVnRXhwKHBhdHRlcm4pLnRlc3QoaW5wdXRUZXh0KTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICB2YWxpZCA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIEFuIGVtcHR5IGZpZWxkIGlzIHZhbGlkIGlmIGl0J3Mgbm90IHJlcXVpcmVkXHJcbiAgICBlbHNlIGlmICghJGVsLnByb3AoJ3JlcXVpcmVkJykpIHtcclxuICAgICAgdmFsaWQgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB2YWxpZDtcclxuICAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgb3IgYSBub3QgYSByYWRpbyBpbnB1dCBpcyB2YWxpZCBiYXNlZCBvbiB3aGV0aGVyIG9yIG5vdCBpdCBpcyByZXF1aXJlZCBhbmQgc2VsZWN0ZWQuIEFsdGhvdWdoIHRoZSBmdW5jdGlvbiB0YXJnZXRzIGEgc2luZ2xlIGA8aW5wdXQ+YCwgaXQgdmFsaWRhdGVzIGJ5IGNoZWNraW5nIHRoZSBgcmVxdWlyZWRgIGFuZCBgY2hlY2tlZGAgcHJvcGVydGllcyBvZiBhbGwgcmFkaW8gYnV0dG9ucyBpbiBpdHMgZ3JvdXAuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGdyb3VwTmFtZSAtIEEgc3RyaW5nIHRoYXQgc3BlY2lmaWVzIHRoZSBuYW1lIG9mIGEgcmFkaW8gYnV0dG9uIGdyb3VwXHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IEJvb2xlYW4gdmFsdWUgZGVwZW5kcyBvbiB3aGV0aGVyIG9yIG5vdCBhdCBsZWFzdCBvbmUgcmFkaW8gaW5wdXQgaGFzIGJlZW4gc2VsZWN0ZWQgKGlmIGl0J3MgcmVxdWlyZWQpXHJcbiAgICovXHJcbiAgdmFsaWRhdGVSYWRpbyhncm91cE5hbWUpIHtcclxuICAgIC8vIElmIGF0IGxlYXN0IG9uZSByYWRpbyBpbiB0aGUgZ3JvdXAgaGFzIHRoZSBgcmVxdWlyZWRgIGF0dHJpYnV0ZSwgdGhlIGdyb3VwIGlzIGNvbnNpZGVyZWQgcmVxdWlyZWRcclxuICAgIC8vIFBlciBXM0Mgc3BlYywgYWxsIHJhZGlvIGJ1dHRvbnMgaW4gYSBncm91cCBzaG91bGQgaGF2ZSBgcmVxdWlyZWRgLCBidXQgd2UncmUgYmVpbmcgbmljZVxyXG4gICAgdmFyICRncm91cCA9IHRoaXMuJGVsZW1lbnQuZmluZChgOnJhZGlvW25hbWU9XCIke2dyb3VwTmFtZX1cIl1gKTtcclxuICAgIHZhciB2YWxpZCA9IGZhbHNlLCByZXF1aXJlZCA9IGZhbHNlO1xyXG5cclxuICAgIC8vIEZvciB0aGUgZ3JvdXAgdG8gYmUgcmVxdWlyZWQsIGF0IGxlYXN0IG9uZSByYWRpbyBuZWVkcyB0byBiZSByZXF1aXJlZFxyXG4gICAgJGdyb3VwLmVhY2goKGksIGUpID0+IHtcclxuICAgICAgaWYgKCQoZSkuYXR0cigncmVxdWlyZWQnKSkge1xyXG4gICAgICAgIHJlcXVpcmVkID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBpZighcmVxdWlyZWQpIHZhbGlkPXRydWU7XHJcblxyXG4gICAgaWYgKCF2YWxpZCkge1xyXG4gICAgICAvLyBGb3IgdGhlIGdyb3VwIHRvIGJlIHZhbGlkLCBhdCBsZWFzdCBvbmUgcmFkaW8gbmVlZHMgdG8gYmUgY2hlY2tlZFxyXG4gICAgICAkZ3JvdXAuZWFjaCgoaSwgZSkgPT4ge1xyXG4gICAgICAgIGlmICgkKGUpLnByb3AoJ2NoZWNrZWQnKSkge1xyXG4gICAgICAgICAgdmFsaWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB2YWxpZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERldGVybWluZXMgaWYgYSBzZWxlY3RlZCBpbnB1dCBwYXNzZXMgYSBjdXN0b20gdmFsaWRhdGlvbiBmdW5jdGlvbi4gTXVsdGlwbGUgdmFsaWRhdGlvbnMgY2FuIGJlIHVzZWQsIGlmIHBhc3NlZCB0byB0aGUgZWxlbWVudCB3aXRoIGBkYXRhLXZhbGlkYXRvcj1cImZvbyBiYXIgYmF6XCJgIGluIGEgc3BhY2Ugc2VwYXJhdGVkIGxpc3RlZC5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gJGVsIC0galF1ZXJ5IGlucHV0IGVsZW1lbnQuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHZhbGlkYXRvcnMgLSBhIHN0cmluZyBvZiBmdW5jdGlvbiBuYW1lcyBtYXRjaGluZyBmdW5jdGlvbnMgaW4gdGhlIEFiaWRlLm9wdGlvbnMudmFsaWRhdG9ycyBvYmplY3QuXHJcbiAgICogQHBhcmFtIHtCb29sZWFufSByZXF1aXJlZCAtIHNlbGYgZXhwbGFuYXRvcnk/XHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IC0gdHJ1ZSBpZiB2YWxpZGF0aW9ucyBwYXNzZWQuXHJcbiAgICovXHJcbiAgbWF0Y2hWYWxpZGF0aW9uKCRlbCwgdmFsaWRhdG9ycywgcmVxdWlyZWQpIHtcclxuICAgIHJlcXVpcmVkID0gcmVxdWlyZWQgPyB0cnVlIDogZmFsc2U7XHJcblxyXG4gICAgdmFyIGNsZWFyID0gdmFsaWRhdG9ycy5zcGxpdCgnICcpLm1hcCgodikgPT4ge1xyXG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zLnZhbGlkYXRvcnNbdl0oJGVsLCByZXF1aXJlZCwgJGVsLnBhcmVudCgpKTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIGNsZWFyLmluZGV4T2YoZmFsc2UpID09PSAtMTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc2V0cyBmb3JtIGlucHV0cyBhbmQgc3R5bGVzXHJcbiAgICogQGZpcmVzIEFiaWRlI2Zvcm1yZXNldFxyXG4gICAqL1xyXG4gIHJlc2V0Rm9ybSgpIHtcclxuICAgIHZhciAkZm9ybSA9IHRoaXMuJGVsZW1lbnQsXHJcbiAgICAgICAgb3B0cyA9IHRoaXMub3B0aW9ucztcclxuXHJcbiAgICAkKGAuJHtvcHRzLmxhYmVsRXJyb3JDbGFzc31gLCAkZm9ybSkubm90KCdzbWFsbCcpLnJlbW92ZUNsYXNzKG9wdHMubGFiZWxFcnJvckNsYXNzKTtcclxuICAgICQoYC4ke29wdHMuaW5wdXRFcnJvckNsYXNzfWAsICRmb3JtKS5ub3QoJ3NtYWxsJykucmVtb3ZlQ2xhc3Mob3B0cy5pbnB1dEVycm9yQ2xhc3MpO1xyXG4gICAgJChgJHtvcHRzLmZvcm1FcnJvclNlbGVjdG9yfS4ke29wdHMuZm9ybUVycm9yQ2xhc3N9YCkucmVtb3ZlQ2xhc3Mob3B0cy5mb3JtRXJyb3JDbGFzcyk7XHJcbiAgICAkZm9ybS5maW5kKCdbZGF0YS1hYmlkZS1lcnJvcl0nKS5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xyXG4gICAgJCgnOmlucHV0JywgJGZvcm0pLm5vdCgnOmJ1dHRvbiwgOnN1Ym1pdCwgOnJlc2V0LCA6aGlkZGVuLCA6cmFkaW8sIDpjaGVja2JveCwgW2RhdGEtYWJpZGUtaWdub3JlXScpLnZhbCgnJykucmVtb3ZlQXR0cignZGF0YS1pbnZhbGlkJyk7XHJcbiAgICAkKCc6aW5wdXQ6cmFkaW8nLCAkZm9ybSkubm90KCdbZGF0YS1hYmlkZS1pZ25vcmVdJykucHJvcCgnY2hlY2tlZCcsZmFsc2UpLnJlbW92ZUF0dHIoJ2RhdGEtaW52YWxpZCcpO1xyXG4gICAgJCgnOmlucHV0OmNoZWNrYm94JywgJGZvcm0pLm5vdCgnW2RhdGEtYWJpZGUtaWdub3JlXScpLnByb3AoJ2NoZWNrZWQnLGZhbHNlKS5yZW1vdmVBdHRyKCdkYXRhLWludmFsaWQnKTtcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgZm9ybSBoYXMgYmVlbiByZXNldC5cclxuICAgICAqIEBldmVudCBBYmlkZSNmb3JtcmVzZXRcclxuICAgICAqL1xyXG4gICAgJGZvcm0udHJpZ2dlcignZm9ybXJlc2V0LnpmLmFiaWRlJywgWyRmb3JtXSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBBYmlkZS5cclxuICAgKiBSZW1vdmVzIGVycm9yIHN0eWxlcyBhbmQgY2xhc3NlcyBmcm9tIGVsZW1lbnRzLCB3aXRob3V0IHJlc2V0dGluZyB0aGVpciB2YWx1ZXMuXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5vZmYoJy5hYmlkZScpXHJcbiAgICAgIC5maW5kKCdbZGF0YS1hYmlkZS1lcnJvcl0nKVxyXG4gICAgICAgIC5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xyXG5cclxuICAgIHRoaXMuJGlucHV0c1xyXG4gICAgICAub2ZmKCcuYWJpZGUnKVxyXG4gICAgICAuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgICBfdGhpcy5yZW1vdmVFcnJvckNsYXNzZXMoJCh0aGlzKSk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZWZhdWx0IHNldHRpbmdzIGZvciBwbHVnaW5cclxuICovXHJcbkFiaWRlLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIFRoZSBkZWZhdWx0IGV2ZW50IHRvIHZhbGlkYXRlIGlucHV0cy4gQ2hlY2tib3hlcyBhbmQgcmFkaW9zIHZhbGlkYXRlIGltbWVkaWF0ZWx5LlxyXG4gICAqIFJlbW92ZSBvciBjaGFuZ2UgdGhpcyB2YWx1ZSBmb3IgbWFudWFsIHZhbGlkYXRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdmaWVsZENoYW5nZSdcclxuICAgKi9cclxuICB2YWxpZGF0ZU9uOiAnZmllbGRDaGFuZ2UnLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyB0byBiZSBhcHBsaWVkIHRvIGlucHV0IGxhYmVscyBvbiBmYWlsZWQgdmFsaWRhdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2lzLWludmFsaWQtbGFiZWwnXHJcbiAgICovXHJcbiAgbGFiZWxFcnJvckNsYXNzOiAnaXMtaW52YWxpZC1sYWJlbCcsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIHRvIGJlIGFwcGxpZWQgdG8gaW5wdXRzIG9uIGZhaWxlZCB2YWxpZGF0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnaXMtaW52YWxpZC1pbnB1dCdcclxuICAgKi9cclxuICBpbnB1dEVycm9yQ2xhc3M6ICdpcy1pbnZhbGlkLWlucHV0JyxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3Mgc2VsZWN0b3IgdG8gdXNlIHRvIHRhcmdldCBGb3JtIEVycm9ycyBmb3Igc2hvdy9oaWRlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnLmZvcm0tZXJyb3InXHJcbiAgICovXHJcbiAgZm9ybUVycm9yU2VsZWN0b3I6ICcuZm9ybS1lcnJvcicsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFkZGVkIHRvIEZvcm0gRXJyb3JzIG9uIGZhaWxlZCB2YWxpZGF0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnaXMtdmlzaWJsZSdcclxuICAgKi9cclxuICBmb3JtRXJyb3JDbGFzczogJ2lzLXZpc2libGUnLFxyXG5cclxuICAvKipcclxuICAgKiBTZXQgdG8gdHJ1ZSB0byB2YWxpZGF0ZSB0ZXh0IGlucHV0cyBvbiBhbnkgdmFsdWUgY2hhbmdlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGxpdmVWYWxpZGF0ZTogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0byB0cnVlIHRvIHZhbGlkYXRlIGlucHV0cyBvbiBibHVyLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIHZhbGlkYXRlT25CbHVyOiBmYWxzZSxcclxuXHJcbiAgcGF0dGVybnM6IHtcclxuICAgIGFscGhhIDogL15bYS16QS1aXSskLyxcclxuICAgIGFscGhhX251bWVyaWMgOiAvXlthLXpBLVowLTldKyQvLFxyXG4gICAgaW50ZWdlciA6IC9eWy0rXT9cXGQrJC8sXHJcbiAgICBudW1iZXIgOiAvXlstK10/XFxkKig/OltcXC5cXCxdXFxkKyk/JC8sXHJcblxyXG4gICAgLy8gYW1leCwgdmlzYSwgZGluZXJzXHJcbiAgICBjYXJkIDogL14oPzo0WzAtOV17MTJ9KD86WzAtOV17M30pP3w1WzEtNV1bMC05XXsxNH18Nig/OjAxMXw1WzAtOV1bMC05XSlbMC05XXsxMn18M1s0N11bMC05XXsxM318Myg/OjBbMC01XXxbNjhdWzAtOV0pWzAtOV17MTF9fCg/OjIxMzF8MTgwMHwzNVxcZHszfSlcXGR7MTF9KSQvLFxyXG4gICAgY3Z2IDogL14oWzAtOV0pezMsNH0kLyxcclxuXHJcbiAgICAvLyBodHRwOi8vd3d3LndoYXR3Zy5vcmcvc3BlY3Mvd2ViLWFwcHMvY3VycmVudC13b3JrL211bHRpcGFnZS9zdGF0ZXMtb2YtdGhlLXR5cGUtYXR0cmlidXRlLmh0bWwjdmFsaWQtZS1tYWlsLWFkZHJlc3NcclxuICAgIGVtYWlsIDogL15bYS16QS1aMC05LiEjJCUmJyorXFwvPT9eX2B7fH1+LV0rQFthLXpBLVowLTldKD86W2EtekEtWjAtOS1dezAsNjF9W2EtekEtWjAtOV0pPyg/OlxcLlthLXpBLVowLTldKD86W2EtekEtWjAtOS1dezAsNjF9W2EtekEtWjAtOV0pPykrJC8sXHJcblxyXG4gICAgdXJsIDogL14oaHR0cHM/fGZ0cHxmaWxlfHNzaCk6XFwvXFwvKCgoKFthLXpBLVpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCglW1xcZGEtZl17Mn0pfFshXFwkJidcXChcXClcXCpcXCssOz1dfDopKkApPygoKFxcZHxbMS05XVxcZHwxXFxkXFxkfDJbMC00XVxcZHwyNVswLTVdKVxcLihcXGR8WzEtOV1cXGR8MVxcZFxcZHwyWzAtNF1cXGR8MjVbMC01XSlcXC4oXFxkfFsxLTldXFxkfDFcXGRcXGR8MlswLTRdXFxkfDI1WzAtNV0pXFwuKFxcZHxbMS05XVxcZHwxXFxkXFxkfDJbMC00XVxcZHwyNVswLTVdKSl8KCgoW2EtekEtWl18XFxkfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoKFthLXpBLVpdfFxcZHxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkoW2EtekEtWl18XFxkfC18XFwufF98fnxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkqKFthLXpBLVpdfFxcZHxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkpKVxcLikrKChbYS16QS1aXXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KChbYS16QS1aXXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkoW2EtekEtWl18XFxkfC18XFwufF98fnxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkqKFthLXpBLVpdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSkpXFwuPykoOlxcZCopPykoXFwvKCgoW2EtekEtWl18XFxkfC18XFwufF98fnxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KCVbXFxkYS1mXXsyfSl8WyFcXCQmJ1xcKFxcKVxcKlxcKyw7PV18OnxAKSsoXFwvKChbYS16QS1aXXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoJVtcXGRhLWZdezJ9KXxbIVxcJCYnXFwoXFwpXFwqXFwrLDs9XXw6fEApKikqKT8pPyhcXD8oKChbYS16QS1aXXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoJVtcXGRhLWZdezJ9KXxbIVxcJCYnXFwoXFwpXFwqXFwrLDs9XXw6fEApfFtcXHVFMDAwLVxcdUY4RkZdfFxcL3xcXD8pKik/KFxcIygoKFthLXpBLVpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCglW1xcZGEtZl17Mn0pfFshXFwkJidcXChcXClcXCpcXCssOz1dfDp8QCl8XFwvfFxcPykqKT8kLyxcclxuICAgIC8vIGFiYy5kZVxyXG4gICAgZG9tYWluIDogL14oW2EtekEtWjAtOV0oW2EtekEtWjAtOVxcLV17MCw2MX1bYS16QS1aMC05XSk/XFwuKStbYS16QS1aXXsyLDh9JC8sXHJcblxyXG4gICAgZGF0ZXRpbWUgOiAvXihbMC0yXVswLTldezN9KVxcLShbMC0xXVswLTldKVxcLShbMC0zXVswLTldKVQoWzAtNV1bMC05XSlcXDooWzAtNV1bMC05XSlcXDooWzAtNV1bMC05XSkoWnwoW1xcLVxcK10oWzAtMV1bMC05XSlcXDowMCkpJC8sXHJcbiAgICAvLyBZWVlZLU1NLUREXHJcbiAgICBkYXRlIDogLyg/OjE5fDIwKVswLTldezJ9LSg/Oig/OjBbMS05XXwxWzAtMl0pLSg/OjBbMS05XXwxWzAtOV18MlswLTldKXwoPzooPyEwMikoPzowWzEtOV18MVswLTJdKS0oPzozMCkpfCg/Oig/OjBbMTM1NzhdfDFbMDJdKS0zMSkpJC8sXHJcbiAgICAvLyBISDpNTTpTU1xyXG4gICAgdGltZSA6IC9eKDBbMC05XXwxWzAtOV18MlswLTNdKSg6WzAtNV1bMC05XSl7Mn0kLyxcclxuICAgIGRhdGVJU08gOiAvXlxcZHs0fVtcXC9cXC1dXFxkezEsMn1bXFwvXFwtXVxcZHsxLDJ9JC8sXHJcbiAgICAvLyBNTS9ERC9ZWVlZXHJcbiAgICBtb250aF9kYXlfeWVhciA6IC9eKDBbMS05XXwxWzAxMl0pWy0gXFwvLl0oMFsxLTldfFsxMl1bMC05XXwzWzAxXSlbLSBcXC8uXVxcZHs0fSQvLFxyXG4gICAgLy8gREQvTU0vWVlZWVxyXG4gICAgZGF5X21vbnRoX3llYXIgOiAvXigwWzEtOV18WzEyXVswLTldfDNbMDFdKVstIFxcLy5dKDBbMS05XXwxWzAxMl0pWy0gXFwvLl1cXGR7NH0kLyxcclxuXHJcbiAgICAvLyAjRkZGIG9yICNGRkZGRkZcclxuICAgIGNvbG9yIDogL14jPyhbYS1mQS1GMC05XXs2fXxbYS1mQS1GMC05XXszfSkkL1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIE9wdGlvbmFsIHZhbGlkYXRpb24gZnVuY3Rpb25zIHRvIGJlIHVzZWQuIGBlcXVhbFRvYCBiZWluZyB0aGUgb25seSBkZWZhdWx0IGluY2x1ZGVkIGZ1bmN0aW9uLlxyXG4gICAqIEZ1bmN0aW9ucyBzaG91bGQgcmV0dXJuIG9ubHkgYSBib29sZWFuIGlmIHRoZSBpbnB1dCBpcyB2YWxpZCBvciBub3QuIEZ1bmN0aW9ucyBhcmUgZ2l2ZW4gdGhlIGZvbGxvd2luZyBhcmd1bWVudHM6XHJcbiAgICogZWwgOiBUaGUgalF1ZXJ5IGVsZW1lbnQgdG8gdmFsaWRhdGUuXHJcbiAgICogcmVxdWlyZWQgOiBCb29sZWFuIHZhbHVlIG9mIHRoZSByZXF1aXJlZCBhdHRyaWJ1dGUgYmUgcHJlc2VudCBvciBub3QuXHJcbiAgICogcGFyZW50IDogVGhlIGRpcmVjdCBwYXJlbnQgb2YgdGhlIGlucHV0LlxyXG4gICAqIEBvcHRpb25cclxuICAgKi9cclxuICB2YWxpZGF0b3JzOiB7XHJcbiAgICBlcXVhbFRvOiBmdW5jdGlvbiAoZWwsIHJlcXVpcmVkLCBwYXJlbnQpIHtcclxuICAgICAgcmV0dXJuICQoYCMke2VsLmF0dHIoJ2RhdGEtZXF1YWx0bycpfWApLnZhbCgpID09PSBlbC52YWwoKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKEFiaWRlLCAnQWJpZGUnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBBY2NvcmRpb24gbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uYWNjb3JkaW9uXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb25cclxuICovXHJcblxyXG5jbGFzcyBBY2NvcmRpb24ge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYW4gYWNjb3JkaW9uLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBBY2NvcmRpb24jaW5pdFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYW4gYWNjb3JkaW9uLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gYSBwbGFpbiBvYmplY3Qgd2l0aCBzZXR0aW5ncyB0byBvdmVycmlkZSB0aGUgZGVmYXVsdCBvcHRpb25zLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIEFjY29yZGlvbi5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdBY2NvcmRpb24nKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ0FjY29yZGlvbicsIHtcclxuICAgICAgJ0VOVEVSJzogJ3RvZ2dsZScsXHJcbiAgICAgICdTUEFDRSc6ICd0b2dnbGUnLFxyXG4gICAgICAnQVJST1dfRE9XTic6ICduZXh0JyxcclxuICAgICAgJ0FSUk9XX1VQJzogJ3ByZXZpb3VzJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgYWNjb3JkaW9uIGJ5IGFuaW1hdGluZyB0aGUgcHJlc2V0IGFjdGl2ZSBwYW5lKHMpLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ3JvbGUnLCAndGFibGlzdCcpO1xyXG4gICAgdGhpcy4kdGFicyA9IHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4oJ1tkYXRhLWFjY29yZGlvbi1pdGVtXScpO1xyXG5cclxuICAgIHRoaXMuJHRhYnMuZWFjaChmdW5jdGlvbihpZHgsIGVsKSB7XHJcbiAgICAgIHZhciAkZWwgPSAkKGVsKSxcclxuICAgICAgICAgICRjb250ZW50ID0gJGVsLmNoaWxkcmVuKCdbZGF0YS10YWItY29udGVudF0nKSxcclxuICAgICAgICAgIGlkID0gJGNvbnRlbnRbMF0uaWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnYWNjb3JkaW9uJyksXHJcbiAgICAgICAgICBsaW5rSWQgPSBlbC5pZCB8fCBgJHtpZH0tbGFiZWxgO1xyXG5cclxuICAgICAgJGVsLmZpbmQoJ2E6Zmlyc3QnKS5hdHRyKHtcclxuICAgICAgICAnYXJpYS1jb250cm9scyc6IGlkLFxyXG4gICAgICAgICdyb2xlJzogJ3RhYicsXHJcbiAgICAgICAgJ2lkJzogbGlua0lkLFxyXG4gICAgICAgICdhcmlhLWV4cGFuZGVkJzogZmFsc2UsXHJcbiAgICAgICAgJ2FyaWEtc2VsZWN0ZWQnOiBmYWxzZVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgICRjb250ZW50LmF0dHIoeydyb2xlJzogJ3RhYnBhbmVsJywgJ2FyaWEtbGFiZWxsZWRieSc6IGxpbmtJZCwgJ2FyaWEtaGlkZGVuJzogdHJ1ZSwgJ2lkJzogaWR9KTtcclxuICAgIH0pO1xyXG4gICAgdmFyICRpbml0QWN0aXZlID0gdGhpcy4kZWxlbWVudC5maW5kKCcuaXMtYWN0aXZlJykuY2hpbGRyZW4oJ1tkYXRhLXRhYi1jb250ZW50XScpO1xyXG4gICAgaWYoJGluaXRBY3RpdmUubGVuZ3RoKXtcclxuICAgICAgdGhpcy5kb3duKCRpbml0QWN0aXZlLCB0cnVlKTtcclxuICAgIH1cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyBmb3IgaXRlbXMgd2l0aGluIHRoZSBhY2NvcmRpb24uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiR0YWJzLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgIHZhciAkZWxlbSA9ICQodGhpcyk7XHJcbiAgICAgIHZhciAkdGFiQ29udGVudCA9ICRlbGVtLmNoaWxkcmVuKCdbZGF0YS10YWItY29udGVudF0nKTtcclxuICAgICAgaWYgKCR0YWJDb250ZW50Lmxlbmd0aCkge1xyXG4gICAgICAgICRlbGVtLmNoaWxkcmVuKCdhJykub2ZmKCdjbGljay56Zi5hY2NvcmRpb24ga2V5ZG93bi56Zi5hY2NvcmRpb24nKVxyXG4gICAgICAgICAgICAgICAub24oJ2NsaWNrLnpmLmFjY29yZGlvbicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIF90aGlzLnRvZ2dsZSgkdGFiQ29udGVudCk7XHJcbiAgICAgICAgfSkub24oJ2tleWRvd24uemYuYWNjb3JkaW9uJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnQWNjb3JkaW9uJywge1xyXG4gICAgICAgICAgICB0b2dnbGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgIF90aGlzLnRvZ2dsZSgkdGFiQ29udGVudCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgIHZhciAkYSA9ICRlbGVtLm5leHQoKS5maW5kKCdhJykuZm9jdXMoKTtcclxuICAgICAgICAgICAgICBpZiAoIV90aGlzLm9wdGlvbnMubXVsdGlFeHBhbmQpIHtcclxuICAgICAgICAgICAgICAgICRhLnRyaWdnZXIoJ2NsaWNrLnpmLmFjY29yZGlvbicpXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwcmV2aW91czogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgdmFyICRhID0gJGVsZW0ucHJldigpLmZpbmQoJ2EnKS5mb2N1cygpO1xyXG4gICAgICAgICAgICAgIGlmICghX3RoaXMub3B0aW9ucy5tdWx0aUV4cGFuZCkge1xyXG4gICAgICAgICAgICAgICAgJGEudHJpZ2dlcignY2xpY2suemYuYWNjb3JkaW9uJylcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHRoZSBzZWxlY3RlZCBjb250ZW50IHBhbmUncyBvcGVuL2Nsb3NlIHN0YXRlLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0galF1ZXJ5IG9iamVjdCBvZiB0aGUgcGFuZSB0byB0b2dnbGUgKGAuYWNjb3JkaW9uLWNvbnRlbnRgKS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICB0b2dnbGUoJHRhcmdldCkge1xyXG4gICAgaWYoJHRhcmdldC5wYXJlbnQoKS5oYXNDbGFzcygnaXMtYWN0aXZlJykpIHtcclxuICAgICAgdGhpcy51cCgkdGFyZ2V0KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuZG93bigkdGFyZ2V0KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIHRoZSBhY2NvcmRpb24gdGFiIGRlZmluZWQgYnkgYCR0YXJnZXRgLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gQWNjb3JkaW9uIHBhbmUgdG8gb3BlbiAoYC5hY2NvcmRpb24tY29udGVudGApLlxyXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gZmlyc3RUaW1lIC0gZmxhZyB0byBkZXRlcm1pbmUgaWYgcmVmbG93IHNob3VsZCBoYXBwZW4uXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbiNkb3duXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZG93bigkdGFyZ2V0LCBmaXJzdFRpbWUpIHtcclxuICAgICR0YXJnZXRcclxuICAgICAgLmF0dHIoJ2FyaWEtaGlkZGVuJywgZmFsc2UpXHJcbiAgICAgIC5wYXJlbnQoJ1tkYXRhLXRhYi1jb250ZW50XScpXHJcbiAgICAgIC5hZGRCYWNrKClcclxuICAgICAgLnBhcmVudCgpLmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5tdWx0aUV4cGFuZCAmJiAhZmlyc3RUaW1lKSB7XHJcbiAgICAgIHZhciAkY3VycmVudEFjdGl2ZSA9IHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4oJy5pcy1hY3RpdmUnKS5jaGlsZHJlbignW2RhdGEtdGFiLWNvbnRlbnRdJyk7XHJcbiAgICAgIGlmICgkY3VycmVudEFjdGl2ZS5sZW5ndGgpIHtcclxuICAgICAgICB0aGlzLnVwKCRjdXJyZW50QWN0aXZlLm5vdCgkdGFyZ2V0KSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAkdGFyZ2V0LnNsaWRlRG93bih0aGlzLm9wdGlvbnMuc2xpZGVTcGVlZCwgKCkgPT4ge1xyXG4gICAgICAvKipcclxuICAgICAgICogRmlyZXMgd2hlbiB0aGUgdGFiIGlzIGRvbmUgb3BlbmluZy5cclxuICAgICAgICogQGV2ZW50IEFjY29yZGlvbiNkb3duXHJcbiAgICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2Rvd24uemYuYWNjb3JkaW9uJywgWyR0YXJnZXRdKTtcclxuICAgIH0pO1xyXG5cclxuICAgICQoYCMkeyR0YXJnZXQuYXR0cignYXJpYS1sYWJlbGxlZGJ5Jyl9YCkuYXR0cih7XHJcbiAgICAgICdhcmlhLWV4cGFuZGVkJzogdHJ1ZSxcclxuICAgICAgJ2FyaWEtc2VsZWN0ZWQnOiB0cnVlXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb3NlcyB0aGUgdGFiIGRlZmluZWQgYnkgYCR0YXJnZXRgLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gQWNjb3JkaW9uIHRhYiB0byBjbG9zZSAoYC5hY2NvcmRpb24tY29udGVudGApLlxyXG4gICAqIEBmaXJlcyBBY2NvcmRpb24jdXBcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICB1cCgkdGFyZ2V0KSB7XHJcbiAgICB2YXIgJGF1bnRzID0gJHRhcmdldC5wYXJlbnQoKS5zaWJsaW5ncygpLFxyXG4gICAgICAgIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBpZigoIXRoaXMub3B0aW9ucy5hbGxvd0FsbENsb3NlZCAmJiAhJGF1bnRzLmhhc0NsYXNzKCdpcy1hY3RpdmUnKSkgfHwgISR0YXJnZXQucGFyZW50KCkuaGFzQ2xhc3MoJ2lzLWFjdGl2ZScpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBGb3VuZGF0aW9uLk1vdmUodGhpcy5vcHRpb25zLnNsaWRlU3BlZWQsICR0YXJnZXQsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICR0YXJnZXQuc2xpZGVVcChfdGhpcy5vcHRpb25zLnNsaWRlU3BlZWQsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSB0YWIgaXMgZG9uZSBjb2xsYXBzaW5nIHVwLlxyXG4gICAgICAgICAqIEBldmVudCBBY2NvcmRpb24jdXBcclxuICAgICAgICAgKi9cclxuICAgICAgICBfdGhpcy4kZWxlbWVudC50cmlnZ2VyKCd1cC56Zi5hY2NvcmRpb24nLCBbJHRhcmdldF0pO1xyXG4gICAgICB9KTtcclxuICAgIC8vIH0pO1xyXG5cclxuICAgICR0YXJnZXQuYXR0cignYXJpYS1oaWRkZW4nLCB0cnVlKVxyXG4gICAgICAgICAgIC5wYXJlbnQoKS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlJyk7XHJcblxyXG4gICAgJChgIyR7JHRhcmdldC5hdHRyKCdhcmlhLWxhYmVsbGVkYnknKX1gKS5hdHRyKHtcclxuICAgICAnYXJpYS1leHBhbmRlZCc6IGZhbHNlLFxyXG4gICAgICdhcmlhLXNlbGVjdGVkJzogZmFsc2VcclxuICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBhbiBhY2NvcmRpb24uXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbiNkZXN0cm95ZWRcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS10YWItY29udGVudF0nKS5zdG9wKHRydWUpLnNsaWRlVXAoMCkuY3NzKCdkaXNwbGF5JywgJycpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdhJykub2ZmKCcuemYuYWNjb3JkaW9uJyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuQWNjb3JkaW9uLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIEFtb3VudCBvZiB0aW1lIHRvIGFuaW1hdGUgdGhlIG9wZW5pbmcgb2YgYW4gYWNjb3JkaW9uIHBhbmUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDI1MFxyXG4gICAqL1xyXG4gIHNsaWRlU3BlZWQ6IDI1MCxcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgYWNjb3JkaW9uIHRvIGhhdmUgbXVsdGlwbGUgb3BlbiBwYW5lcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBtdWx0aUV4cGFuZDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIGFjY29yZGlvbiB0byBjbG9zZSBhbGwgcGFuZXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYWxsb3dBbGxDbG9zZWQ6IGZhbHNlXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihBY2NvcmRpb24sICdBY2NvcmRpb24nKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBBY2NvcmRpb25NZW51IG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmFjY29yZGlvbk1lbnVcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvblxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm5lc3RcclxuICovXHJcblxyXG5jbGFzcyBBY2NvcmRpb25NZW51IHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGFuIGFjY29yZGlvbiBtZW51LlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBBY2NvcmRpb25NZW51I2luaXRcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGFuIGFjY29yZGlvbiBtZW51LlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBY2NvcmRpb25NZW51LmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5OZXN0LkZlYXRoZXIodGhpcy4kZWxlbWVudCwgJ2FjY29yZGlvbicpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdBY2NvcmRpb25NZW51Jyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdBY2NvcmRpb25NZW51Jywge1xyXG4gICAgICAnRU5URVInOiAndG9nZ2xlJyxcclxuICAgICAgJ1NQQUNFJzogJ3RvZ2dsZScsXHJcbiAgICAgICdBUlJPV19SSUdIVCc6ICdvcGVuJyxcclxuICAgICAgJ0FSUk9XX1VQJzogJ3VwJyxcclxuICAgICAgJ0FSUk9XX0RPV04nOiAnZG93bicsXHJcbiAgICAgICdBUlJPV19MRUZUJzogJ2Nsb3NlJyxcclxuICAgICAgJ0VTQ0FQRSc6ICdjbG9zZUFsbCdcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcblxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgYWNjb3JkaW9uIG1lbnUgYnkgaGlkaW5nIGFsbCBuZXN0ZWQgbWVudXMuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtc3VibWVudV0nKS5ub3QoJy5pcy1hY3RpdmUnKS5zbGlkZVVwKDApOy8vLmZpbmQoJ2EnKS5jc3MoJ3BhZGRpbmctbGVmdCcsICcxcmVtJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoe1xyXG4gICAgICAncm9sZSc6ICdtZW51JyxcclxuICAgICAgJ2FyaWEtbXVsdGlzZWxlY3RhYmxlJzogdGhpcy5vcHRpb25zLm11bHRpT3BlblxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy4kbWVudUxpbmtzID0gdGhpcy4kZWxlbWVudC5maW5kKCcuaXMtYWNjb3JkaW9uLXN1Ym1lbnUtcGFyZW50Jyk7XHJcbiAgICB0aGlzLiRtZW51TGlua3MuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICB2YXIgbGlua0lkID0gdGhpcy5pZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdhY2MtbWVudS1saW5rJyksXHJcbiAgICAgICAgICAkZWxlbSA9ICQodGhpcyksXHJcbiAgICAgICAgICAkc3ViID0gJGVsZW0uY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJyksXHJcbiAgICAgICAgICBzdWJJZCA9ICRzdWJbMF0uaWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnYWNjLW1lbnUnKSxcclxuICAgICAgICAgIGlzQWN0aXZlID0gJHN1Yi5oYXNDbGFzcygnaXMtYWN0aXZlJyk7XHJcbiAgICAgICRlbGVtLmF0dHIoe1xyXG4gICAgICAgICdhcmlhLWNvbnRyb2xzJzogc3ViSWQsXHJcbiAgICAgICAgJ2FyaWEtZXhwYW5kZWQnOiBpc0FjdGl2ZSxcclxuICAgICAgICAncm9sZSc6ICdtZW51aXRlbScsXHJcbiAgICAgICAgJ2lkJzogbGlua0lkXHJcbiAgICAgIH0pO1xyXG4gICAgICAkc3ViLmF0dHIoe1xyXG4gICAgICAgICdhcmlhLWxhYmVsbGVkYnknOiBsaW5rSWQsXHJcbiAgICAgICAgJ2FyaWEtaGlkZGVuJzogIWlzQWN0aXZlLFxyXG4gICAgICAgICdyb2xlJzogJ21lbnUnLFxyXG4gICAgICAgICdpZCc6IHN1YklkXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgICB2YXIgaW5pdFBhbmVzID0gdGhpcy4kZWxlbWVudC5maW5kKCcuaXMtYWN0aXZlJyk7XHJcbiAgICBpZihpbml0UGFuZXMubGVuZ3RoKXtcclxuICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgaW5pdFBhbmVzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgICBfdGhpcy5kb3duKCQodGhpcykpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyBmb3IgaXRlbXMgd2l0aGluIHRoZSBtZW51LlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdsaScpLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgIHZhciAkc3VibWVudSA9ICQodGhpcykuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJyk7XHJcblxyXG4gICAgICBpZiAoJHN1Ym1lbnUubGVuZ3RoKSB7XHJcbiAgICAgICAgJCh0aGlzKS5jaGlsZHJlbignYScpLm9mZignY2xpY2suemYuYWNjb3JkaW9uTWVudScpLm9uKCdjbGljay56Zi5hY2NvcmRpb25NZW51JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuICAgICAgICAgIF90aGlzLnRvZ2dsZSgkc3VibWVudSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0pLm9uKCdrZXlkb3duLnpmLmFjY29yZGlvbm1lbnUnLCBmdW5jdGlvbihlKXtcclxuICAgICAgdmFyICRlbGVtZW50ID0gJCh0aGlzKSxcclxuICAgICAgICAgICRlbGVtZW50cyA9ICRlbGVtZW50LnBhcmVudCgndWwnKS5jaGlsZHJlbignbGknKSxcclxuICAgICAgICAgICRwcmV2RWxlbWVudCxcclxuICAgICAgICAgICRuZXh0RWxlbWVudCxcclxuICAgICAgICAgICR0YXJnZXQgPSAkZWxlbWVudC5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKTtcclxuXHJcbiAgICAgICRlbGVtZW50cy5lYWNoKGZ1bmN0aW9uKGkpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS5pcygkZWxlbWVudCkpIHtcclxuICAgICAgICAgICRwcmV2RWxlbWVudCA9ICRlbGVtZW50cy5lcShNYXRoLm1heCgwLCBpLTEpKS5maW5kKCdhJykuZmlyc3QoKTtcclxuICAgICAgICAgICRuZXh0RWxlbWVudCA9ICRlbGVtZW50cy5lcShNYXRoLm1pbihpKzEsICRlbGVtZW50cy5sZW5ndGgtMSkpLmZpbmQoJ2EnKS5maXJzdCgpO1xyXG5cclxuICAgICAgICAgIGlmICgkKHRoaXMpLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XTp2aXNpYmxlJykubGVuZ3RoKSB7IC8vIGhhcyBvcGVuIHN1YiBtZW51XHJcbiAgICAgICAgICAgICRuZXh0RWxlbWVudCA9ICRlbGVtZW50LmZpbmQoJ2xpOmZpcnN0LWNoaWxkJykuZmluZCgnYScpLmZpcnN0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAoJCh0aGlzKS5pcygnOmZpcnN0LWNoaWxkJykpIHsgLy8gaXMgZmlyc3QgZWxlbWVudCBvZiBzdWIgbWVudVxyXG4gICAgICAgICAgICAkcHJldkVsZW1lbnQgPSAkZWxlbWVudC5wYXJlbnRzKCdsaScpLmZpcnN0KCkuZmluZCgnYScpLmZpcnN0KCk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKCRwcmV2RWxlbWVudC5wYXJlbnRzKCdsaScpLmZpcnN0KCkuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdOnZpc2libGUnKS5sZW5ndGgpIHsgLy8gaWYgcHJldmlvdXMgZWxlbWVudCBoYXMgb3BlbiBzdWIgbWVudVxyXG4gICAgICAgICAgICAkcHJldkVsZW1lbnQgPSAkcHJldkVsZW1lbnQucGFyZW50cygnbGknKS5maW5kKCdsaTpsYXN0LWNoaWxkJykuZmluZCgnYScpLmZpcnN0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAoJCh0aGlzKS5pcygnOmxhc3QtY2hpbGQnKSkgeyAvLyBpcyBsYXN0IGVsZW1lbnQgb2Ygc3ViIG1lbnVcclxuICAgICAgICAgICAgJG5leHRFbGVtZW50ID0gJGVsZW1lbnQucGFyZW50cygnbGknKS5maXJzdCgpLm5leHQoJ2xpJykuZmluZCgnYScpLmZpcnN0KCk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnQWNjb3JkaW9uTWVudScsIHtcclxuICAgICAgICBvcGVuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICgkdGFyZ2V0LmlzKCc6aGlkZGVuJykpIHtcclxuICAgICAgICAgICAgX3RoaXMuZG93bigkdGFyZ2V0KTtcclxuICAgICAgICAgICAgJHRhcmdldC5maW5kKCdsaScpLmZpcnN0KCkuZmluZCgnYScpLmZpcnN0KCkuZm9jdXMoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICgkdGFyZ2V0Lmxlbmd0aCAmJiAhJHRhcmdldC5pcygnOmhpZGRlbicpKSB7IC8vIGNsb3NlIGFjdGl2ZSBzdWIgb2YgdGhpcyBpdGVtXHJcbiAgICAgICAgICAgIF90aGlzLnVwKCR0YXJnZXQpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmICgkZWxlbWVudC5wYXJlbnQoJ1tkYXRhLXN1Ym1lbnVdJykubGVuZ3RoKSB7IC8vIGNsb3NlIGN1cnJlbnRseSBvcGVuIHN1YlxyXG4gICAgICAgICAgICBfdGhpcy51cCgkZWxlbWVudC5wYXJlbnQoJ1tkYXRhLXN1Ym1lbnVdJykpO1xyXG4gICAgICAgICAgICAkZWxlbWVudC5wYXJlbnRzKCdsaScpLmZpcnN0KCkuZmluZCgnYScpLmZpcnN0KCkuZm9jdXMoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHVwOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICRwcmV2RWxlbWVudC5mb2N1cygpO1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkb3duOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICRuZXh0RWxlbWVudC5mb2N1cygpO1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB0b2dnbGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKCRlbGVtZW50LmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBfdGhpcy50b2dnbGUoJGVsZW1lbnQuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJykpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY2xvc2VBbGw6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgX3RoaXMuaGlkZUFsbCgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24ocHJldmVudERlZmF1bHQpIHtcclxuICAgICAgICAgIGlmIChwcmV2ZW50RGVmYXVsdCkge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTsvLy5hdHRyKCd0YWJpbmRleCcsIDApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvc2VzIGFsbCBwYW5lcyBvZiB0aGUgbWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBoaWRlQWxsKCkge1xyXG4gICAgdGhpcy51cCh0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXN1Ym1lbnVdJykpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgYWxsIHBhbmVzIG9mIHRoZSBtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHNob3dBbGwoKSB7XHJcbiAgICB0aGlzLmRvd24odGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1zdWJtZW51XScpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZXMgdGhlIG9wZW4vY2xvc2Ugc3RhdGUgb2YgYSBzdWJtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gdGhlIHN1Ym1lbnUgdG8gdG9nZ2xlXHJcbiAgICovXHJcbiAgdG9nZ2xlKCR0YXJnZXQpe1xyXG4gICAgaWYoISR0YXJnZXQuaXMoJzphbmltYXRlZCcpKSB7XHJcbiAgICAgIGlmICghJHRhcmdldC5pcygnOmhpZGRlbicpKSB7XHJcbiAgICAgICAgdGhpcy51cCgkdGFyZ2V0KTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICB0aGlzLmRvd24oJHRhcmdldCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIHRoZSBzdWItbWVudSBkZWZpbmVkIGJ5IGAkdGFyZ2V0YC5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIFN1Yi1tZW51IHRvIG9wZW4uXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbk1lbnUjZG93blxyXG4gICAqL1xyXG4gIGRvd24oJHRhcmdldCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBpZighdGhpcy5vcHRpb25zLm11bHRpT3Blbikge1xyXG4gICAgICB0aGlzLnVwKHRoaXMuJGVsZW1lbnQuZmluZCgnLmlzLWFjdGl2ZScpLm5vdCgkdGFyZ2V0LnBhcmVudHNVbnRpbCh0aGlzLiRlbGVtZW50KS5hZGQoJHRhcmdldCkpKTtcclxuICAgIH1cclxuXHJcbiAgICAkdGFyZ2V0LmFkZENsYXNzKCdpcy1hY3RpdmUnKS5hdHRyKHsnYXJpYS1oaWRkZW4nOiBmYWxzZX0pXHJcbiAgICAgIC5wYXJlbnQoJy5pcy1hY2NvcmRpb24tc3VibWVudS1wYXJlbnQnKS5hdHRyKHsnYXJpYS1leHBhbmRlZCc6IHRydWV9KTtcclxuXHJcbiAgICAgIC8vRm91bmRhdGlvbi5Nb3ZlKHRoaXMub3B0aW9ucy5zbGlkZVNwZWVkLCAkdGFyZ2V0LCBmdW5jdGlvbigpIHtcclxuICAgICAgICAkdGFyZ2V0LnNsaWRlRG93bihfdGhpcy5vcHRpb25zLnNsaWRlU3BlZWQsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgbWVudSBpcyBkb25lIG9wZW5pbmcuXHJcbiAgICAgICAgICAgKiBAZXZlbnQgQWNjb3JkaW9uTWVudSNkb3duXHJcbiAgICAgICAgICAgKi9cclxuICAgICAgICAgIF90aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2Rvd24uemYuYWNjb3JkaW9uTWVudScsIFskdGFyZ2V0XSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIC8vfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9zZXMgdGhlIHN1Yi1tZW51IGRlZmluZWQgYnkgYCR0YXJnZXRgLiBBbGwgc3ViLW1lbnVzIGluc2lkZSB0aGUgdGFyZ2V0IHdpbGwgYmUgY2xvc2VkIGFzIHdlbGwuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBTdWItbWVudSB0byBjbG9zZS5cclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uTWVudSN1cFxyXG4gICAqL1xyXG4gIHVwKCR0YXJnZXQpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAvL0ZvdW5kYXRpb24uTW92ZSh0aGlzLm9wdGlvbnMuc2xpZGVTcGVlZCwgJHRhcmdldCwgZnVuY3Rpb24oKXtcclxuICAgICAgJHRhcmdldC5zbGlkZVVwKF90aGlzLm9wdGlvbnMuc2xpZGVTcGVlZCwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIG1lbnUgaXMgZG9uZSBjb2xsYXBzaW5nIHVwLlxyXG4gICAgICAgICAqIEBldmVudCBBY2NvcmRpb25NZW51I3VwXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgX3RoaXMuJGVsZW1lbnQudHJpZ2dlcigndXAuemYuYWNjb3JkaW9uTWVudScsIFskdGFyZ2V0XSk7XHJcbiAgICAgIH0pO1xyXG4gICAgLy99KTtcclxuXHJcbiAgICB2YXIgJG1lbnVzID0gJHRhcmdldC5maW5kKCdbZGF0YS1zdWJtZW51XScpLnNsaWRlVXAoMCkuYWRkQmFjaygpLmF0dHIoJ2FyaWEtaGlkZGVuJywgdHJ1ZSk7XHJcblxyXG4gICAgJG1lbnVzLnBhcmVudCgnLmlzLWFjY29yZGlvbi1zdWJtZW51LXBhcmVudCcpLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCBmYWxzZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBhY2NvcmRpb24gbWVudS5cclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uTWVudSNkZXN0cm95ZWRcclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1zdWJtZW51XScpLnNsaWRlRG93bigwKS5jc3MoJ2Rpc3BsYXknLCAnJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ2EnKS5vZmYoJ2NsaWNrLnpmLmFjY29yZGlvbk1lbnUnKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLk5lc3QuQnVybih0aGlzLiRlbGVtZW50LCAnYWNjb3JkaW9uJyk7XHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5BY2NvcmRpb25NZW51LmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIEFtb3VudCBvZiB0aW1lIHRvIGFuaW1hdGUgdGhlIG9wZW5pbmcgb2YgYSBzdWJtZW51IGluIG1zLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAyNTBcclxuICAgKi9cclxuICBzbGlkZVNwZWVkOiAyNTAsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIG1lbnUgdG8gaGF2ZSBtdWx0aXBsZSBvcGVuIHBhbmVzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgbXVsdGlPcGVuOiB0cnVlXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihBY2NvcmRpb25NZW51LCAnQWNjb3JkaW9uTWVudScpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIERyaWxsZG93biBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5kcmlsbGRvd25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvblxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm5lc3RcclxuICovXHJcblxyXG5jbGFzcyBEcmlsbGRvd24ge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYSBkcmlsbGRvd24gbWVudS5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGFuIGFjY29yZGlvbiBtZW51LlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBEcmlsbGRvd24uZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLk5lc3QuRmVhdGhlcih0aGlzLiRlbGVtZW50LCAnZHJpbGxkb3duJyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0RyaWxsZG93bicpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignRHJpbGxkb3duJywge1xyXG4gICAgICAnRU5URVInOiAnb3BlbicsXHJcbiAgICAgICdTUEFDRSc6ICdvcGVuJyxcclxuICAgICAgJ0FSUk9XX1JJR0hUJzogJ25leHQnLFxyXG4gICAgICAnQVJST1dfVVAnOiAndXAnLFxyXG4gICAgICAnQVJST1dfRE9XTic6ICdkb3duJyxcclxuICAgICAgJ0FSUk9XX0xFRlQnOiAncHJldmlvdXMnLFxyXG4gICAgICAnRVNDQVBFJzogJ2Nsb3NlJyxcclxuICAgICAgJ1RBQic6ICdkb3duJyxcclxuICAgICAgJ1NISUZUX1RBQic6ICd1cCdcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGRyaWxsZG93biBieSBjcmVhdGluZyBqUXVlcnkgY29sbGVjdGlvbnMgb2YgZWxlbWVudHNcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdGhpcy4kc3VibWVudUFuY2hvcnMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2xpLmlzLWRyaWxsZG93bi1zdWJtZW51LXBhcmVudCcpLmNoaWxkcmVuKCdhJyk7XHJcbiAgICB0aGlzLiRzdWJtZW51cyA9IHRoaXMuJHN1Ym1lbnVBbmNob3JzLnBhcmVudCgnbGknKS5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKTtcclxuICAgIHRoaXMuJG1lbnVJdGVtcyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnbGknKS5ub3QoJy5qcy1kcmlsbGRvd24tYmFjaycpLmF0dHIoJ3JvbGUnLCAnbWVudWl0ZW0nKS5maW5kKCdhJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2RhdGEtbXV0YXRlJywgKHRoaXMuJGVsZW1lbnQuYXR0cignZGF0YS1kcmlsbGRvd24nKSB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdkcmlsbGRvd24nKSkpO1xyXG5cclxuICAgIHRoaXMuX3ByZXBhcmVNZW51KCk7XHJcbiAgICB0aGlzLl9yZWdpc3RlckV2ZW50cygpO1xyXG5cclxuICAgIHRoaXMuX2tleWJvYXJkRXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBwcmVwYXJlcyBkcmlsbGRvd24gbWVudSBieSBzZXR0aW5nIGF0dHJpYnV0ZXMgdG8gbGlua3MgYW5kIGVsZW1lbnRzXHJcbiAgICogc2V0cyBhIG1pbiBoZWlnaHQgdG8gcHJldmVudCBjb250ZW50IGp1bXBpbmdcclxuICAgKiB3cmFwcyB0aGUgZWxlbWVudCBpZiBub3QgYWxyZWFkeSB3cmFwcGVkXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBfcHJlcGFyZU1lbnUoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgLy8gaWYoIXRoaXMub3B0aW9ucy5ob2xkT3Blbil7XHJcbiAgICAvLyAgIHRoaXMuX21lbnVMaW5rRXZlbnRzKCk7XHJcbiAgICAvLyB9XHJcbiAgICB0aGlzLiRzdWJtZW51QW5jaG9ycy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciAkbGluayA9ICQodGhpcyk7XHJcbiAgICAgIHZhciAkc3ViID0gJGxpbmsucGFyZW50KCk7XHJcbiAgICAgIGlmKF90aGlzLm9wdGlvbnMucGFyZW50TGluayl7XHJcbiAgICAgICAgJGxpbmsuY2xvbmUoKS5wcmVwZW5kVG8oJHN1Yi5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKSkud3JhcCgnPGxpIGNsYXNzPVwiaXMtc3VibWVudS1wYXJlbnQtaXRlbSBpcy1zdWJtZW51LWl0ZW0gaXMtZHJpbGxkb3duLXN1Ym1lbnUtaXRlbVwiIHJvbGU9XCJtZW51LWl0ZW1cIj48L2xpPicpO1xyXG4gICAgICB9XHJcbiAgICAgICRsaW5rLmRhdGEoJ3NhdmVkSHJlZicsICRsaW5rLmF0dHIoJ2hyZWYnKSkucmVtb3ZlQXR0cignaHJlZicpLmF0dHIoJ3RhYmluZGV4JywgMCk7XHJcbiAgICAgICRsaW5rLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpXHJcbiAgICAgICAgICAuYXR0cih7XHJcbiAgICAgICAgICAgICdhcmlhLWhpZGRlbic6IHRydWUsXHJcbiAgICAgICAgICAgICd0YWJpbmRleCc6IDAsXHJcbiAgICAgICAgICAgICdyb2xlJzogJ21lbnUnXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgX3RoaXMuX2V2ZW50cygkbGluayk7XHJcbiAgICB9KTtcclxuICAgIHRoaXMuJHN1Ym1lbnVzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgdmFyICRtZW51ID0gJCh0aGlzKSxcclxuICAgICAgICAgICRiYWNrID0gJG1lbnUuZmluZCgnLmpzLWRyaWxsZG93bi1iYWNrJyk7XHJcbiAgICAgIGlmKCEkYmFjay5sZW5ndGgpe1xyXG4gICAgICAgIHN3aXRjaCAoX3RoaXMub3B0aW9ucy5iYWNrQnV0dG9uUG9zaXRpb24pIHtcclxuICAgICAgICAgIGNhc2UgXCJib3R0b21cIjpcclxuICAgICAgICAgICAgJG1lbnUuYXBwZW5kKF90aGlzLm9wdGlvbnMuYmFja0J1dHRvbik7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgY2FzZSBcInRvcFwiOlxyXG4gICAgICAgICAgICAkbWVudS5wcmVwZW5kKF90aGlzLm9wdGlvbnMuYmFja0J1dHRvbik7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlVuc3VwcG9ydGVkIGJhY2tCdXR0b25Qb3NpdGlvbiB2YWx1ZSAnXCIgKyBfdGhpcy5vcHRpb25zLmJhY2tCdXR0b25Qb3NpdGlvbiArIFwiJ1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgX3RoaXMuX2JhY2soJG1lbnUpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaWYoIXRoaXMub3B0aW9ucy5hdXRvSGVpZ2h0KSB7XHJcbiAgICAgIHRoaXMuJHN1Ym1lbnVzLmFkZENsYXNzKCdkcmlsbGRvd24tc3VibWVudS1jb3Zlci1wcmV2aW91cycpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKCF0aGlzLiRlbGVtZW50LnBhcmVudCgpLmhhc0NsYXNzKCdpcy1kcmlsbGRvd24nKSl7XHJcbiAgICAgIHRoaXMuJHdyYXBwZXIgPSAkKHRoaXMub3B0aW9ucy53cmFwcGVyKS5hZGRDbGFzcygnaXMtZHJpbGxkb3duJyk7XHJcbiAgICAgIGlmKHRoaXMub3B0aW9ucy5hbmltYXRlSGVpZ2h0KSB0aGlzLiR3cmFwcGVyLmFkZENsYXNzKCdhbmltYXRlLWhlaWdodCcpO1xyXG4gICAgICB0aGlzLiR3cmFwcGVyID0gdGhpcy4kZWxlbWVudC53cmFwKHRoaXMuJHdyYXBwZXIpLnBhcmVudCgpLmNzcyh0aGlzLl9nZXRNYXhEaW1zKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgX3Jlc2l6ZSgpIHtcclxuICAgIHRoaXMuJHdyYXBwZXIuY3NzKHsnbWF4LXdpZHRoJzogJ25vbmUnLCAnbWluLWhlaWdodCc6ICdub25lJ30pO1xyXG4gICAgLy8gX2dldE1heERpbXMgaGFzIHNpZGUgZWZmZWN0cyAoYm9vKSBidXQgY2FsbGluZyBpdCBzaG91bGQgdXBkYXRlIGFsbCBvdGhlciBuZWNlc3NhcnkgaGVpZ2h0cyAmIHdpZHRoc1xyXG4gICAgdGhpcy4kd3JhcHBlci5jc3ModGhpcy5fZ2V0TWF4RGltcygpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgdG8gZWxlbWVudHMgaW4gdGhlIG1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGVsZW0gLSB0aGUgY3VycmVudCBtZW51IGl0ZW0gdG8gYWRkIGhhbmRsZXJzIHRvLlxyXG4gICAqL1xyXG4gIF9ldmVudHMoJGVsZW0pIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgJGVsZW0ub2ZmKCdjbGljay56Zi5kcmlsbGRvd24nKVxyXG4gICAgLm9uKCdjbGljay56Zi5kcmlsbGRvd24nLCBmdW5jdGlvbihlKXtcclxuICAgICAgaWYoJChlLnRhcmdldCkucGFyZW50c1VudGlsKCd1bCcsICdsaScpLmhhc0NsYXNzKCdpcy1kcmlsbGRvd24tc3VibWVudS1wYXJlbnQnKSl7XHJcbiAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIGlmKGUudGFyZ2V0ICE9PSBlLmN1cnJlbnRUYXJnZXQuZmlyc3RFbGVtZW50Q2hpbGQpe1xyXG4gICAgICAvLyAgIHJldHVybiBmYWxzZTtcclxuICAgICAgLy8gfVxyXG4gICAgICBfdGhpcy5fc2hvdygkZWxlbS5wYXJlbnQoJ2xpJykpO1xyXG5cclxuICAgICAgaWYoX3RoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2spe1xyXG4gICAgICAgIHZhciAkYm9keSA9ICQoJ2JvZHknKTtcclxuICAgICAgICAkYm9keS5vZmYoJy56Zi5kcmlsbGRvd24nKS5vbignY2xpY2suemYuZHJpbGxkb3duJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IF90aGlzLiRlbGVtZW50WzBdIHx8ICQuY29udGFpbnMoX3RoaXMuJGVsZW1lbnRbMF0sIGUudGFyZ2V0KSkgeyByZXR1cm47IH1cclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIF90aGlzLl9oaWRlQWxsKCk7XHJcbiAgICAgICAgICAkYm9keS5vZmYoJy56Zi5kcmlsbGRvd24nKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblx0ICB0aGlzLiRlbGVtZW50Lm9uKCdtdXRhdGVtZS56Zi50cmlnZ2VyJywgdGhpcy5fcmVzaXplLmJpbmQodGhpcykpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyB0byB0aGUgbWVudSBlbGVtZW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3JlZ2lzdGVyRXZlbnRzKCkge1xyXG4gICAgaWYodGhpcy5vcHRpb25zLnNjcm9sbFRvcCl7XHJcbiAgICAgIHRoaXMuX2JpbmRIYW5kbGVyID0gdGhpcy5fc2Nyb2xsVG9wLmJpbmQodGhpcyk7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ29wZW4uemYuZHJpbGxkb3duIGhpZGUuemYuZHJpbGxkb3duIGNsb3NlZC56Zi5kcmlsbGRvd24nLHRoaXMuX2JpbmRIYW5kbGVyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNjcm9sbCB0byBUb3Agb2YgRWxlbWVudCBvciBkYXRhLXNjcm9sbC10b3AtZWxlbWVudFxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBEcmlsbGRvd24jc2Nyb2xsbWVcclxuICAgKi9cclxuICBfc2Nyb2xsVG9wKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHZhciAkc2Nyb2xsVG9wRWxlbWVudCA9IF90aGlzLm9wdGlvbnMuc2Nyb2xsVG9wRWxlbWVudCE9Jyc/JChfdGhpcy5vcHRpb25zLnNjcm9sbFRvcEVsZW1lbnQpOl90aGlzLiRlbGVtZW50LFxyXG4gICAgICAgIHNjcm9sbFBvcyA9IHBhcnNlSW50KCRzY3JvbGxUb3BFbGVtZW50Lm9mZnNldCgpLnRvcCtfdGhpcy5vcHRpb25zLnNjcm9sbFRvcE9mZnNldCk7XHJcbiAgICAkKCdodG1sLCBib2R5Jykuc3RvcCh0cnVlKS5hbmltYXRlKHsgc2Nyb2xsVG9wOiBzY3JvbGxQb3MgfSwgX3RoaXMub3B0aW9ucy5hbmltYXRpb25EdXJhdGlvbiwgX3RoaXMub3B0aW9ucy5hbmltYXRpb25FYXNpbmcsZnVuY3Rpb24oKXtcclxuICAgICAgLyoqXHJcbiAgICAgICAgKiBGaXJlcyBhZnRlciB0aGUgbWVudSBoYXMgc2Nyb2xsZWRcclxuICAgICAgICAqIEBldmVudCBEcmlsbGRvd24jc2Nyb2xsbWVcclxuICAgICAgICAqL1xyXG4gICAgICBpZih0aGlzPT09JCgnaHRtbCcpWzBdKV90aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3Njcm9sbG1lLnpmLmRyaWxsZG93bicpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGtleWRvd24gZXZlbnQgbGlzdGVuZXIgdG8gYGxpYCdzIGluIHRoZSBtZW51LlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2tleWJvYXJkRXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiRtZW51SXRlbXMuYWRkKHRoaXMuJGVsZW1lbnQuZmluZCgnLmpzLWRyaWxsZG93bi1iYWNrID4gYSwgLmlzLXN1Ym1lbnUtcGFyZW50LWl0ZW0gPiBhJykpLm9uKCdrZXlkb3duLnpmLmRyaWxsZG93bicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICB2YXIgJGVsZW1lbnQgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgJGVsZW1lbnRzID0gJGVsZW1lbnQucGFyZW50KCdsaScpLnBhcmVudCgndWwnKS5jaGlsZHJlbignbGknKS5jaGlsZHJlbignYScpLFxyXG4gICAgICAgICAgJHByZXZFbGVtZW50LFxyXG4gICAgICAgICAgJG5leHRFbGVtZW50O1xyXG5cclxuICAgICAgJGVsZW1lbnRzLmVhY2goZnVuY3Rpb24oaSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLmlzKCRlbGVtZW50KSkge1xyXG4gICAgICAgICAgJHByZXZFbGVtZW50ID0gJGVsZW1lbnRzLmVxKE1hdGgubWF4KDAsIGktMSkpO1xyXG4gICAgICAgICAgJG5leHRFbGVtZW50ID0gJGVsZW1lbnRzLmVxKE1hdGgubWluKGkrMSwgJGVsZW1lbnRzLmxlbmd0aC0xKSk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdEcmlsbGRvd24nLCB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoJGVsZW1lbnQuaXMoX3RoaXMuJHN1Ym1lbnVBbmNob3JzKSkge1xyXG4gICAgICAgICAgICBfdGhpcy5fc2hvdygkZWxlbWVudC5wYXJlbnQoJ2xpJykpO1xyXG4gICAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZCgkZWxlbWVudCksIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLmZpbmQoJ3VsIGxpIGEnKS5maWx0ZXIoX3RoaXMuJG1lbnVJdGVtcykuZmlyc3QoKS5mb2N1cygpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBwcmV2aW91czogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBfdGhpcy5faGlkZSgkZWxlbWVudC5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpKTtcclxuICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZCgkZWxlbWVudCksIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLnBhcmVudCgndWwnKS5wYXJlbnQoJ2xpJykuY2hpbGRyZW4oJ2EnKS5maXJzdCgpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgIH0sIDEpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHVwOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICRwcmV2RWxlbWVudC5mb2N1cygpO1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkb3duOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICRuZXh0RWxlbWVudC5mb2N1cygpO1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBfdGhpcy5fYmFjaygpO1xyXG4gICAgICAgICAgLy9fdGhpcy4kbWVudUl0ZW1zLmZpcnN0KCkuZm9jdXMoKTsgLy8gZm9jdXMgdG8gZmlyc3QgZWxlbWVudFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoISRlbGVtZW50LmlzKF90aGlzLiRtZW51SXRlbXMpKSB7IC8vIG5vdCBtZW51IGl0ZW0gbWVhbnMgYmFjayBidXR0b25cclxuICAgICAgICAgICAgX3RoaXMuX2hpZGUoJGVsZW1lbnQucGFyZW50KCdsaScpLnBhcmVudCgndWwnKSk7XHJcbiAgICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZCgkZWxlbWVudCksIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykucGFyZW50KCdsaScpLmNoaWxkcmVuKCdhJykuZmlyc3QoKS5mb2N1cygpO1xyXG4gICAgICAgICAgICAgIH0sIDEpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKCRlbGVtZW50LmlzKF90aGlzLiRzdWJtZW51QW5jaG9ycykpIHtcclxuICAgICAgICAgICAgX3RoaXMuX3Nob3coJGVsZW1lbnQucGFyZW50KCdsaScpKTtcclxuICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQoJGVsZW1lbnQpLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5maW5kKCd1bCBsaSBhJykuZmlsdGVyKF90aGlzLiRtZW51SXRlbXMpLmZpcnN0KCkuZm9jdXMoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24ocHJldmVudERlZmF1bHQpIHtcclxuICAgICAgICAgIGlmIChwcmV2ZW50RGVmYXVsdCkge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTsgLy8gZW5kIGtleWJvYXJkQWNjZXNzXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9zZXMgYWxsIG9wZW4gZWxlbWVudHMsIGFuZCByZXR1cm5zIHRvIHJvb3QgbWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgRHJpbGxkb3duI2Nsb3NlZFxyXG4gICAqL1xyXG4gIF9oaWRlQWxsKCkge1xyXG4gICAgdmFyICRlbGVtID0gdGhpcy4kZWxlbWVudC5maW5kKCcuaXMtZHJpbGxkb3duLXN1Ym1lbnUuaXMtYWN0aXZlJykuYWRkQ2xhc3MoJ2lzLWNsb3NpbmcnKTtcclxuICAgIGlmKHRoaXMub3B0aW9ucy5hdXRvSGVpZ2h0KSB0aGlzLiR3cmFwcGVyLmNzcyh7aGVpZ2h0OiRlbGVtLnBhcmVudCgpLmNsb3Nlc3QoJ3VsJykuZGF0YSgnY2FsY0hlaWdodCcpfSk7XHJcbiAgICAkZWxlbS5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKCRlbGVtKSwgZnVuY3Rpb24oZSl7XHJcbiAgICAgICRlbGVtLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUgaXMtY2xvc2luZycpO1xyXG4gICAgfSk7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgbWVudSBpcyBmdWxseSBjbG9zZWQuXHJcbiAgICAgICAgICogQGV2ZW50IERyaWxsZG93biNjbG9zZWRcclxuICAgICAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignY2xvc2VkLnpmLmRyaWxsZG93bicpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBsaXN0ZW5lciBmb3IgZWFjaCBgYmFja2AgYnV0dG9uLCBhbmQgY2xvc2VzIG9wZW4gbWVudXMuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIERyaWxsZG93biNiYWNrXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRlbGVtIC0gdGhlIGN1cnJlbnQgc3ViLW1lbnUgdG8gYWRkIGBiYWNrYCBldmVudC5cclxuICAgKi9cclxuICBfYmFjaygkZWxlbSkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICRlbGVtLm9mZignY2xpY2suemYuZHJpbGxkb3duJyk7XHJcbiAgICAkZWxlbS5jaGlsZHJlbignLmpzLWRyaWxsZG93bi1iYWNrJylcclxuICAgICAgLm9uKCdjbGljay56Zi5kcmlsbGRvd24nLCBmdW5jdGlvbihlKXtcclxuICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdtb3VzZXVwIG9uIGJhY2snKTtcclxuICAgICAgICBfdGhpcy5faGlkZSgkZWxlbSk7XHJcblxyXG4gICAgICAgIC8vIElmIHRoZXJlIGlzIGEgcGFyZW50IHN1Ym1lbnUsIGNhbGwgc2hvd1xyXG4gICAgICAgIGxldCBwYXJlbnRTdWJNZW51ID0gJGVsZW0ucGFyZW50KCdsaScpLnBhcmVudCgndWwnKS5wYXJlbnQoJ2xpJyk7XHJcbiAgICAgICAgaWYgKHBhcmVudFN1Yk1lbnUubGVuZ3RoKSB7XHJcbiAgICAgICAgICBfdGhpcy5fc2hvdyhwYXJlbnRTdWJNZW51KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBsaXN0ZW5lciB0byBtZW51IGl0ZW1zIHcvbyBzdWJtZW51cyB0byBjbG9zZSBvcGVuIG1lbnVzIG9uIGNsaWNrLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX21lbnVMaW5rRXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMuJG1lbnVJdGVtcy5ub3QoJy5pcy1kcmlsbGRvd24tc3VibWVudS1wYXJlbnQnKVxyXG4gICAgICAgIC5vZmYoJ2NsaWNrLnpmLmRyaWxsZG93bicpXHJcbiAgICAgICAgLm9uKCdjbGljay56Zi5kcmlsbGRvd24nLCBmdW5jdGlvbihlKXtcclxuICAgICAgICAgIC8vIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIF90aGlzLl9oaWRlQWxsKCk7XHJcbiAgICAgICAgICB9LCAwKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyBhIHN1Ym1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIERyaWxsZG93biNvcGVuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRlbGVtIC0gdGhlIGN1cnJlbnQgZWxlbWVudCB3aXRoIGEgc3VibWVudSB0byBvcGVuLCBpLmUuIHRoZSBgbGlgIHRhZy5cclxuICAgKi9cclxuICBfc2hvdygkZWxlbSkge1xyXG4gICAgaWYodGhpcy5vcHRpb25zLmF1dG9IZWlnaHQpIHRoaXMuJHdyYXBwZXIuY3NzKHtoZWlnaHQ6JGVsZW0uY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJykuZGF0YSgnY2FsY0hlaWdodCcpfSk7XHJcbiAgICAkZWxlbS5hdHRyKCdhcmlhLWV4cGFuZGVkJywgdHJ1ZSk7XHJcbiAgICAkZWxlbS5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKS5hZGRDbGFzcygnaXMtYWN0aXZlJykuYXR0cignYXJpYS1oaWRkZW4nLCBmYWxzZSk7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIHN1Ym1lbnUgaGFzIG9wZW5lZC5cclxuICAgICAqIEBldmVudCBEcmlsbGRvd24jb3BlblxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ29wZW4uemYuZHJpbGxkb3duJywgWyRlbGVtXSk7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogSGlkZXMgYSBzdWJtZW51XHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIERyaWxsZG93biNoaWRlXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRlbGVtIC0gdGhlIGN1cnJlbnQgc3ViLW1lbnUgdG8gaGlkZSwgaS5lLiB0aGUgYHVsYCB0YWcuXHJcbiAgICovXHJcbiAgX2hpZGUoJGVsZW0pIHtcclxuICAgIGlmKHRoaXMub3B0aW9ucy5hdXRvSGVpZ2h0KSB0aGlzLiR3cmFwcGVyLmNzcyh7aGVpZ2h0OiRlbGVtLnBhcmVudCgpLmNsb3Nlc3QoJ3VsJykuZGF0YSgnY2FsY0hlaWdodCcpfSk7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgJGVsZW0ucGFyZW50KCdsaScpLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCBmYWxzZSk7XHJcbiAgICAkZWxlbS5hdHRyKCdhcmlhLWhpZGRlbicsIHRydWUpLmFkZENsYXNzKCdpcy1jbG9zaW5nJylcclxuICAgICRlbGVtLmFkZENsYXNzKCdpcy1jbG9zaW5nJylcclxuICAgICAgICAgLm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQoJGVsZW0pLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICRlbGVtLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUgaXMtY2xvc2luZycpO1xyXG4gICAgICAgICAgICRlbGVtLmJsdXIoKTtcclxuICAgICAgICAgfSk7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIHN1Ym1lbnUgaGFzIGNsb3NlZC5cclxuICAgICAqIEBldmVudCBEcmlsbGRvd24jaGlkZVxyXG4gICAgICovXHJcbiAgICAkZWxlbS50cmlnZ2VyKCdoaWRlLnpmLmRyaWxsZG93bicsIFskZWxlbV0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSXRlcmF0ZXMgdGhyb3VnaCB0aGUgbmVzdGVkIG1lbnVzIHRvIGNhbGN1bGF0ZSB0aGUgbWluLWhlaWdodCwgYW5kIG1heC13aWR0aCBmb3IgdGhlIG1lbnUuXHJcbiAgICogUHJldmVudHMgY29udGVudCBqdW1waW5nLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2dldE1heERpbXMoKSB7XHJcbiAgICB2YXIgIG1heEhlaWdodCA9IDAsIHJlc3VsdCA9IHt9LCBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLiRzdWJtZW51cy5hZGQodGhpcy4kZWxlbWVudCkuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICB2YXIgbnVtT2ZFbGVtcyA9ICQodGhpcykuY2hpbGRyZW4oJ2xpJykubGVuZ3RoO1xyXG4gICAgICB2YXIgaGVpZ2h0ID0gRm91bmRhdGlvbi5Cb3guR2V0RGltZW5zaW9ucyh0aGlzKS5oZWlnaHQ7XHJcbiAgICAgIG1heEhlaWdodCA9IGhlaWdodCA+IG1heEhlaWdodCA/IGhlaWdodCA6IG1heEhlaWdodDtcclxuICAgICAgaWYoX3RoaXMub3B0aW9ucy5hdXRvSGVpZ2h0KSB7XHJcbiAgICAgICAgJCh0aGlzKS5kYXRhKCdjYWxjSGVpZ2h0JyxoZWlnaHQpO1xyXG4gICAgICAgIGlmICghJCh0aGlzKS5oYXNDbGFzcygnaXMtZHJpbGxkb3duLXN1Ym1lbnUnKSkgcmVzdWx0WydoZWlnaHQnXSA9IGhlaWdodDtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYoIXRoaXMub3B0aW9ucy5hdXRvSGVpZ2h0KSByZXN1bHRbJ21pbi1oZWlnaHQnXSA9IGAke21heEhlaWdodH1weGA7XHJcblxyXG4gICAgcmVzdWx0WydtYXgtd2lkdGgnXSA9IGAke3RoaXMuJGVsZW1lbnRbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGh9cHhgO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgRHJpbGxkb3duIE1lbnVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgaWYodGhpcy5vcHRpb25zLnNjcm9sbFRvcCkgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi5kcmlsbGRvd24nLHRoaXMuX2JpbmRIYW5kbGVyKTtcclxuICAgIHRoaXMuX2hpZGVBbGwoKTtcclxuXHQgIHRoaXMuJGVsZW1lbnQub2ZmKCdtdXRhdGVtZS56Zi50cmlnZ2VyJyk7XHJcbiAgICBGb3VuZGF0aW9uLk5lc3QuQnVybih0aGlzLiRlbGVtZW50LCAnZHJpbGxkb3duJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LnVud3JhcCgpXHJcbiAgICAgICAgICAgICAgICAgLmZpbmQoJy5qcy1kcmlsbGRvd24tYmFjaywgLmlzLXN1Ym1lbnUtcGFyZW50LWl0ZW0nKS5yZW1vdmUoKVxyXG4gICAgICAgICAgICAgICAgIC5lbmQoKS5maW5kKCcuaXMtYWN0aXZlLCAuaXMtY2xvc2luZywgLmlzLWRyaWxsZG93bi1zdWJtZW51JykucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZSBpcy1jbG9zaW5nIGlzLWRyaWxsZG93bi1zdWJtZW51JylcclxuICAgICAgICAgICAgICAgICAuZW5kKCkuZmluZCgnW2RhdGEtc3VibWVudV0nKS5yZW1vdmVBdHRyKCdhcmlhLWhpZGRlbiB0YWJpbmRleCByb2xlJyk7XHJcbiAgICB0aGlzLiRzdWJtZW51QW5jaG9ycy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICAkKHRoaXMpLm9mZignLnpmLmRyaWxsZG93bicpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy4kc3VibWVudXMucmVtb3ZlQ2xhc3MoJ2RyaWxsZG93bi1zdWJtZW51LWNvdmVyLXByZXZpb3VzJyk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdhJykuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICB2YXIgJGxpbmsgPSAkKHRoaXMpO1xyXG4gICAgICAkbGluay5yZW1vdmVBdHRyKCd0YWJpbmRleCcpO1xyXG4gICAgICBpZigkbGluay5kYXRhKCdzYXZlZEhyZWYnKSl7XHJcbiAgICAgICAgJGxpbmsuYXR0cignaHJlZicsICRsaW5rLmRhdGEoJ3NhdmVkSHJlZicpKS5yZW1vdmVEYXRhKCdzYXZlZEhyZWYnKTtcclxuICAgICAgfWVsc2V7IHJldHVybjsgfVxyXG4gICAgfSk7XHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfTtcclxufVxyXG5cclxuRHJpbGxkb3duLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIE1hcmt1cCB1c2VkIGZvciBKUyBnZW5lcmF0ZWQgYmFjayBidXR0b24uIFByZXBlbmRlZCAgb3IgYXBwZW5kZWQgKHNlZSBiYWNrQnV0dG9uUG9zaXRpb24pIHRvIHN1Ym1lbnUgbGlzdHMgYW5kIGRlbGV0ZWQgb24gYGRlc3Ryb3lgIG1ldGhvZCwgJ2pzLWRyaWxsZG93bi1iYWNrJyBjbGFzcyByZXF1aXJlZC4gUmVtb3ZlIHRoZSBiYWNrc2xhc2ggKGBcXGApIGlmIGNvcHkgYW5kIHBhc3RpbmcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICc8XFxsaT48XFxhPkJhY2s8XFwvYT48XFwvbGk+J1xyXG4gICAqL1xyXG4gIGJhY2tCdXR0b246ICc8bGkgY2xhc3M9XCJqcy1kcmlsbGRvd24tYmFja1wiPjxhIHRhYmluZGV4PVwiMFwiPkJhY2s8L2E+PC9saT4nLFxyXG4gIC8qKlxyXG4gICAqIFBvc2l0aW9uIHRoZSBiYWNrIGJ1dHRvbiBlaXRoZXIgYXQgdGhlIHRvcCBvciBib3R0b20gb2YgZHJpbGxkb3duIHN1Ym1lbnVzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBib3R0b21cclxuICAgKi9cclxuICBiYWNrQnV0dG9uUG9zaXRpb246ICd0b3AnLFxyXG4gIC8qKlxyXG4gICAqIE1hcmt1cCB1c2VkIHRvIHdyYXAgZHJpbGxkb3duIG1lbnUuIFVzZSBhIGNsYXNzIG5hbWUgZm9yIGluZGVwZW5kZW50IHN0eWxpbmc7IHRoZSBKUyBhcHBsaWVkIGNsYXNzOiBgaXMtZHJpbGxkb3duYCBpcyByZXF1aXJlZC4gUmVtb3ZlIHRoZSBiYWNrc2xhc2ggKGBcXGApIGlmIGNvcHkgYW5kIHBhc3RpbmcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICc8XFxkaXYgY2xhc3M9XCJpcy1kcmlsbGRvd25cIj48XFwvZGl2PidcclxuICAgKi9cclxuICB3cmFwcGVyOiAnPGRpdj48L2Rpdj4nLFxyXG4gIC8qKlxyXG4gICAqIEFkZHMgdGhlIHBhcmVudCBsaW5rIHRvIHRoZSBzdWJtZW51LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIHBhcmVudExpbms6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBtZW51IHRvIHJldHVybiB0byByb290IGxpc3Qgb24gYm9keSBjbGljay5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBjbG9zZU9uQ2xpY2s6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBtZW51IHRvIGF1dG8gYWRqdXN0IGhlaWdodC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhdXRvSGVpZ2h0OiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbmltYXRlIHRoZSBhdXRvIGFkanVzdCBoZWlnaHQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYW5pbWF0ZUhlaWdodDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogU2Nyb2xsIHRvIHRoZSB0b3Agb2YgdGhlIG1lbnUgYWZ0ZXIgb3BlbmluZyBhIHN1Ym1lbnUgb3IgbmF2aWdhdGluZyBiYWNrIHVzaW5nIHRoZSBtZW51IGJhY2sgYnV0dG9uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgc2Nyb2xsVG9wOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBTdHJpbmcganF1ZXJ5IHNlbGVjdG9yIChmb3IgZXhhbXBsZSAnYm9keScpIG9mIGVsZW1lbnQgdG8gdGFrZSBvZmZzZXQoKS50b3AgZnJvbSwgaWYgZW1wdHkgc3RyaW5nIHRoZSBkcmlsbGRvd24gbWVudSBvZmZzZXQoKS50b3AgaXMgdGFrZW5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJydcclxuICAgKi9cclxuICBzY3JvbGxUb3BFbGVtZW50OiAnJyxcclxuICAvKipcclxuICAgKiBTY3JvbGxUb3Agb2Zmc2V0XHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEwMFxyXG4gICAqL1xyXG4gIHNjcm9sbFRvcE9mZnNldDogMCxcclxuICAvKipcclxuICAgKiBTY3JvbGwgYW5pbWF0aW9uIGR1cmF0aW9uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwMFxyXG4gICAqL1xyXG4gIGFuaW1hdGlvbkR1cmF0aW9uOiA1MDAsXHJcbiAgLyoqXHJcbiAgICogU2Nyb2xsIGFuaW1hdGlvbiBlYXNpbmdcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3N3aW5nJ1xyXG4gICAqL1xyXG4gIGFuaW1hdGlvbkVhc2luZzogJ3N3aW5nJ1xyXG4gIC8vIGhvbGRPcGVuOiBmYWxzZVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oRHJpbGxkb3duLCAnRHJpbGxkb3duJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogRHJvcGRvd24gbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uZHJvcGRvd25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmJveFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqL1xyXG5cclxuY2xhc3MgRHJvcGRvd24ge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYSBkcm9wZG93bi5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGEgZHJvcGRvd24uXHJcbiAgICogICAgICAgIE9iamVjdCBzaG91bGQgYmUgb2YgdGhlIGRyb3Bkb3duIHBhbmVsLCByYXRoZXIgdGhhbiBpdHMgYW5jaG9yLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBEcm9wZG93bi5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0Ryb3Bkb3duJyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdEcm9wZG93bicsIHtcclxuICAgICAgJ0VOVEVSJzogJ29wZW4nLFxyXG4gICAgICAnU1BBQ0UnOiAnb3BlbicsXHJcbiAgICAgICdFU0NBUEUnOiAnY2xvc2UnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBwbHVnaW4gYnkgc2V0dGluZy9jaGVja2luZyBvcHRpb25zIGFuZCBhdHRyaWJ1dGVzLCBhZGRpbmcgaGVscGVyIHZhcmlhYmxlcywgYW5kIHNhdmluZyB0aGUgYW5jaG9yLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgJGlkID0gdGhpcy4kZWxlbWVudC5hdHRyKCdpZCcpO1xyXG5cclxuICAgIHRoaXMuJGFuY2hvciA9ICQoYFtkYXRhLXRvZ2dsZT1cIiR7JGlkfVwiXWApLmxlbmd0aCA/ICQoYFtkYXRhLXRvZ2dsZT1cIiR7JGlkfVwiXWApIDogJChgW2RhdGEtb3Blbj1cIiR7JGlkfVwiXWApO1xyXG4gICAgdGhpcy4kYW5jaG9yLmF0dHIoe1xyXG4gICAgICAnYXJpYS1jb250cm9scyc6ICRpZCxcclxuICAgICAgJ2RhdGEtaXMtZm9jdXMnOiBmYWxzZSxcclxuICAgICAgJ2RhdGEteWV0aS1ib3gnOiAkaWQsXHJcbiAgICAgICdhcmlhLWhhc3BvcHVwJzogdHJ1ZSxcclxuICAgICAgJ2FyaWEtZXhwYW5kZWQnOiBmYWxzZVxyXG5cclxuICAgIH0pO1xyXG5cclxuICAgIGlmKHRoaXMub3B0aW9ucy5wYXJlbnRDbGFzcyl7XHJcbiAgICAgIHRoaXMuJHBhcmVudCA9IHRoaXMuJGVsZW1lbnQucGFyZW50cygnLicgKyB0aGlzLm9wdGlvbnMucGFyZW50Q2xhc3MpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIHRoaXMuJHBhcmVudCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICB0aGlzLm9wdGlvbnMucG9zaXRpb25DbGFzcyA9IHRoaXMuZ2V0UG9zaXRpb25DbGFzcygpO1xyXG4gICAgdGhpcy5jb3VudGVyID0gNDtcclxuICAgIHRoaXMudXNlZFBvc2l0aW9ucyA9IFtdO1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKHtcclxuICAgICAgJ2FyaWEtaGlkZGVuJzogJ3RydWUnLFxyXG4gICAgICAnZGF0YS15ZXRpLWJveCc6ICRpZCxcclxuICAgICAgJ2RhdGEtcmVzaXplJzogJGlkLFxyXG4gICAgICAnYXJpYS1sYWJlbGxlZGJ5JzogdGhpcy4kYW5jaG9yWzBdLmlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ2RkLWFuY2hvcicpXHJcbiAgICB9KTtcclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGRldGVybWluZSBjdXJyZW50IG9yaWVudGF0aW9uIG9mIGRyb3Bkb3duIHBhbmUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHJldHVybnMge1N0cmluZ30gcG9zaXRpb24gLSBzdHJpbmcgdmFsdWUgb2YgYSBwb3NpdGlvbiBjbGFzcy5cclxuICAgKi9cclxuICBnZXRQb3NpdGlvbkNsYXNzKCkge1xyXG4gICAgdmFyIHZlcnRpY2FsUG9zaXRpb24gPSB0aGlzLiRlbGVtZW50WzBdLmNsYXNzTmFtZS5tYXRjaCgvKHRvcHxsZWZ0fHJpZ2h0fGJvdHRvbSkvZyk7XHJcbiAgICAgICAgdmVydGljYWxQb3NpdGlvbiA9IHZlcnRpY2FsUG9zaXRpb24gPyB2ZXJ0aWNhbFBvc2l0aW9uWzBdIDogJyc7XHJcbiAgICB2YXIgaG9yaXpvbnRhbFBvc2l0aW9uID0gL2Zsb2F0LShcXFMrKS8uZXhlYyh0aGlzLiRhbmNob3JbMF0uY2xhc3NOYW1lKTtcclxuICAgICAgICBob3Jpem9udGFsUG9zaXRpb24gPSBob3Jpem9udGFsUG9zaXRpb24gPyBob3Jpem9udGFsUG9zaXRpb25bMV0gOiAnJztcclxuICAgIHZhciBwb3NpdGlvbiA9IGhvcml6b250YWxQb3NpdGlvbiA/IGhvcml6b250YWxQb3NpdGlvbiArICcgJyArIHZlcnRpY2FsUG9zaXRpb24gOiB2ZXJ0aWNhbFBvc2l0aW9uO1xyXG5cclxuICAgIHJldHVybiBwb3NpdGlvbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkanVzdHMgdGhlIGRyb3Bkb3duIHBhbmVzIG9yaWVudGF0aW9uIGJ5IGFkZGluZy9yZW1vdmluZyBwb3NpdGlvbmluZyBjbGFzc2VzLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBvc2l0aW9uIC0gcG9zaXRpb24gY2xhc3MgdG8gcmVtb3ZlLlxyXG4gICAqL1xyXG4gIF9yZXBvc2l0aW9uKHBvc2l0aW9uKSB7XHJcbiAgICB0aGlzLnVzZWRQb3NpdGlvbnMucHVzaChwb3NpdGlvbiA/IHBvc2l0aW9uIDogJ2JvdHRvbScpO1xyXG4gICAgLy9kZWZhdWx0LCB0cnkgc3dpdGNoaW5nIHRvIG9wcG9zaXRlIHNpZGVcclxuICAgIGlmKCFwb3NpdGlvbiAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3RvcCcpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKCd0b3AnKTtcclxuICAgIH1lbHNlIGlmKHBvc2l0aW9uID09PSAndG9wJyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH1lbHNlIGlmKHBvc2l0aW9uID09PSAnbGVmdCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdyaWdodCcpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHBvc2l0aW9uKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdyaWdodCcpO1xyXG4gICAgfWVsc2UgaWYocG9zaXRpb24gPT09ICdyaWdodCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MocG9zaXRpb24pXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoJ2xlZnQnKTtcclxuICAgIH1cclxuXHJcbiAgICAvL2lmIGRlZmF1bHQgY2hhbmdlIGRpZG4ndCB3b3JrLCB0cnkgYm90dG9tIG9yIGxlZnQgZmlyc3RcclxuICAgIGVsc2UgaWYoIXBvc2l0aW9uICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigndG9wJykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3MoJ2xlZnQnKTtcclxuICAgIH1lbHNlIGlmKHBvc2l0aW9uID09PSAndG9wJyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHBvc2l0aW9uKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdsZWZ0Jyk7XHJcbiAgICB9ZWxzZSBpZihwb3NpdGlvbiA9PT0gJ2xlZnQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigncmlnaHQnKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH1lbHNlIGlmKHBvc2l0aW9uID09PSAncmlnaHQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfVxyXG4gICAgLy9pZiBub3RoaW5nIGNsZWFyZWQsIHNldCB0byBib3R0b21cclxuICAgIGVsc2V7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jbGFzc0NoYW5nZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5jb3VudGVyLS07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBwb3NpdGlvbiBhbmQgb3JpZW50YXRpb24gb2YgdGhlIGRyb3Bkb3duIHBhbmUsIGNoZWNrcyBmb3IgY29sbGlzaW9ucy5cclxuICAgKiBSZWN1cnNpdmVseSBjYWxscyBpdHNlbGYgaWYgYSBjb2xsaXNpb24gaXMgZGV0ZWN0ZWQsIHdpdGggYSBuZXcgcG9zaXRpb24gY2xhc3MuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc2V0UG9zaXRpb24oKSB7XHJcbiAgICBpZih0aGlzLiRhbmNob3IuYXR0cignYXJpYS1leHBhbmRlZCcpID09PSAnZmFsc2UnKXsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmdldFBvc2l0aW9uQ2xhc3MoKSxcclxuICAgICAgICAkZWxlRGltcyA9IEZvdW5kYXRpb24uQm94LkdldERpbWVuc2lvbnModGhpcy4kZWxlbWVudCksXHJcbiAgICAgICAgJGFuY2hvckRpbXMgPSBGb3VuZGF0aW9uLkJveC5HZXREaW1lbnNpb25zKHRoaXMuJGFuY2hvciksXHJcbiAgICAgICAgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIGRpcmVjdGlvbiA9IChwb3NpdGlvbiA9PT0gJ2xlZnQnID8gJ2xlZnQnIDogKChwb3NpdGlvbiA9PT0gJ3JpZ2h0JykgPyAnbGVmdCcgOiAndG9wJykpLFxyXG4gICAgICAgIHBhcmFtID0gKGRpcmVjdGlvbiA9PT0gJ3RvcCcpID8gJ2hlaWdodCcgOiAnd2lkdGgnLFxyXG4gICAgICAgIG9mZnNldCA9IChwYXJhbSA9PT0gJ2hlaWdodCcpID8gdGhpcy5vcHRpb25zLnZPZmZzZXQgOiB0aGlzLm9wdGlvbnMuaE9mZnNldDtcclxuXHJcbiAgICBpZigoJGVsZURpbXMud2lkdGggPj0gJGVsZURpbXMud2luZG93RGltcy53aWR0aCkgfHwgKCF0aGlzLmNvdW50ZXIgJiYgIUZvdW5kYXRpb24uQm94LkltTm90VG91Y2hpbmdZb3UodGhpcy4kZWxlbWVudCwgdGhpcy4kcGFyZW50KSkpe1xyXG4gICAgICB2YXIgbmV3V2lkdGggPSAkZWxlRGltcy53aW5kb3dEaW1zLndpZHRoLFxyXG4gICAgICAgICAgcGFyZW50SE9mZnNldCA9IDA7XHJcbiAgICAgIGlmKHRoaXMuJHBhcmVudCl7XHJcbiAgICAgICAgdmFyICRwYXJlbnREaW1zID0gRm91bmRhdGlvbi5Cb3guR2V0RGltZW5zaW9ucyh0aGlzLiRwYXJlbnQpLFxyXG4gICAgICAgICAgICBwYXJlbnRIT2Zmc2V0ID0gJHBhcmVudERpbXMub2Zmc2V0LmxlZnQ7XHJcbiAgICAgICAgaWYgKCRwYXJlbnREaW1zLndpZHRoIDwgbmV3V2lkdGgpe1xyXG4gICAgICAgICAgbmV3V2lkdGggPSAkcGFyZW50RGltcy53aWR0aDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub2Zmc2V0KEZvdW5kYXRpb24uQm94LkdldE9mZnNldHModGhpcy4kZWxlbWVudCwgdGhpcy4kYW5jaG9yLCAnY2VudGVyIGJvdHRvbScsIHRoaXMub3B0aW9ucy52T2Zmc2V0LCB0aGlzLm9wdGlvbnMuaE9mZnNldCArIHBhcmVudEhPZmZzZXQsIHRydWUpKS5jc3Moe1xyXG4gICAgICAgICd3aWR0aCc6IG5ld1dpZHRoIC0gKHRoaXMub3B0aW9ucy5oT2Zmc2V0ICogMiksXHJcbiAgICAgICAgJ2hlaWdodCc6ICdhdXRvJ1xyXG4gICAgICB9KTtcclxuICAgICAgdGhpcy5jbGFzc0NoYW5nZWQgPSB0cnVlO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vZmZzZXQoRm91bmRhdGlvbi5Cb3guR2V0T2Zmc2V0cyh0aGlzLiRlbGVtZW50LCB0aGlzLiRhbmNob3IsIHBvc2l0aW9uLCB0aGlzLm9wdGlvbnMudk9mZnNldCwgdGhpcy5vcHRpb25zLmhPZmZzZXQpKTtcclxuXHJcbiAgICB3aGlsZSghRm91bmRhdGlvbi5Cb3guSW1Ob3RUb3VjaGluZ1lvdSh0aGlzLiRlbGVtZW50LCB0aGlzLiRwYXJlbnQsIHRydWUpICYmIHRoaXMuY291bnRlcil7XHJcbiAgICAgIHRoaXMuX3JlcG9zaXRpb24ocG9zaXRpb24pO1xyXG4gICAgICB0aGlzLl9zZXRQb3NpdGlvbigpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBsaXN0ZW5lcnMgdG8gdGhlIGVsZW1lbnQgdXRpbGl6aW5nIHRoZSB0cmlnZ2VycyB1dGlsaXR5IGxpYnJhcnkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMuJGVsZW1lbnQub24oe1xyXG4gICAgICAnb3Blbi56Zi50cmlnZ2VyJzogdGhpcy5vcGVuLmJpbmQodGhpcyksXHJcbiAgICAgICdjbG9zZS56Zi50cmlnZ2VyJzogdGhpcy5jbG9zZS5iaW5kKHRoaXMpLFxyXG4gICAgICAndG9nZ2xlLnpmLnRyaWdnZXInOiB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpLFxyXG4gICAgICAncmVzaXplbWUuemYudHJpZ2dlcic6IHRoaXMuX3NldFBvc2l0aW9uLmJpbmQodGhpcylcclxuICAgIH0pO1xyXG5cclxuICAgIGlmKHRoaXMub3B0aW9ucy5ob3Zlcil7XHJcbiAgICAgIHRoaXMuJGFuY2hvci5vZmYoJ21vdXNlZW50ZXIuemYuZHJvcGRvd24gbW91c2VsZWF2ZS56Zi5kcm9wZG93bicpXHJcbiAgICAgIC5vbignbW91c2VlbnRlci56Zi5kcm9wZG93bicsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdmFyIGJvZHlEYXRhID0gJCgnYm9keScpLmRhdGEoKTtcclxuICAgICAgICBpZih0eXBlb2YoYm9keURhdGEud2hhdGlucHV0KSA9PT0gJ3VuZGVmaW5lZCcgfHwgYm9keURhdGEud2hhdGlucHV0ID09PSAnbW91c2UnKSB7XHJcbiAgICAgICAgICBjbGVhclRpbWVvdXQoX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgICBfdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICBfdGhpcy5vcGVuKCk7XHJcbiAgICAgICAgICAgIF90aGlzLiRhbmNob3IuZGF0YSgnaG92ZXInLCB0cnVlKTtcclxuICAgICAgICAgIH0sIF90aGlzLm9wdGlvbnMuaG92ZXJEZWxheSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KS5vbignbW91c2VsZWF2ZS56Zi5kcm9wZG93bicsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgIF90aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgICAgX3RoaXMuJGFuY2hvci5kYXRhKCdob3ZlcicsIGZhbHNlKTtcclxuICAgICAgICB9LCBfdGhpcy5vcHRpb25zLmhvdmVyRGVsYXkpO1xyXG4gICAgICB9KTtcclxuICAgICAgaWYodGhpcy5vcHRpb25zLmhvdmVyUGFuZSl7XHJcbiAgICAgICAgdGhpcy4kZWxlbWVudC5vZmYoJ21vdXNlZW50ZXIuemYuZHJvcGRvd24gbW91c2VsZWF2ZS56Zi5kcm9wZG93bicpXHJcbiAgICAgICAgICAgIC5vbignbW91c2VlbnRlci56Zi5kcm9wZG93bicsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgICAgICB9KS5vbignbW91c2VsZWF2ZS56Zi5kcm9wZG93bicsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgIF90aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuJGFuY2hvci5kYXRhKCdob3ZlcicsIGZhbHNlKTtcclxuICAgICAgICAgICAgICB9LCBfdGhpcy5vcHRpb25zLmhvdmVyRGVsYXkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhpcy4kYW5jaG9yLmFkZCh0aGlzLiRlbGVtZW50KS5vbigna2V5ZG93bi56Zi5kcm9wZG93bicsIGZ1bmN0aW9uKGUpIHtcclxuXHJcbiAgICAgIHZhciAkdGFyZ2V0ID0gJCh0aGlzKSxcclxuICAgICAgICB2aXNpYmxlRm9jdXNhYmxlRWxlbWVudHMgPSBGb3VuZGF0aW9uLktleWJvYXJkLmZpbmRGb2N1c2FibGUoX3RoaXMuJGVsZW1lbnQpO1xyXG5cclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ0Ryb3Bkb3duJywge1xyXG4gICAgICAgIG9wZW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKCR0YXJnZXQuaXMoX3RoaXMuJGFuY2hvcikpIHtcclxuICAgICAgICAgICAgX3RoaXMub3BlbigpO1xyXG4gICAgICAgICAgICBfdGhpcy4kZWxlbWVudC5hdHRyKCd0YWJpbmRleCcsIC0xKS5mb2N1cygpO1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgICAgX3RoaXMuJGFuY2hvci5mb2N1cygpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYW4gZXZlbnQgaGFuZGxlciB0byB0aGUgYm9keSB0byBjbG9zZSBhbnkgZHJvcGRvd25zIG9uIGEgY2xpY2suXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfYWRkQm9keUhhbmRsZXIoKSB7XHJcbiAgICAgdmFyICRib2R5ID0gJChkb2N1bWVudC5ib2R5KS5ub3QodGhpcy4kZWxlbWVudCksXHJcbiAgICAgICAgIF90aGlzID0gdGhpcztcclxuICAgICAkYm9keS5vZmYoJ2NsaWNrLnpmLmRyb3Bkb3duJylcclxuICAgICAgICAgIC5vbignY2xpY2suemYuZHJvcGRvd24nLCBmdW5jdGlvbihlKXtcclxuICAgICAgICAgICAgaWYoX3RoaXMuJGFuY2hvci5pcyhlLnRhcmdldCkgfHwgX3RoaXMuJGFuY2hvci5maW5kKGUudGFyZ2V0KS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYoX3RoaXMuJGVsZW1lbnQuZmluZChlLnRhcmdldCkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgICAgICRib2R5Lm9mZignY2xpY2suemYuZHJvcGRvd24nKTtcclxuICAgICAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgdGhlIGRyb3Bkb3duIHBhbmUsIGFuZCBmaXJlcyBhIGJ1YmJsaW5nIGV2ZW50IHRvIGNsb3NlIG90aGVyIGRyb3Bkb3ducy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgRHJvcGRvd24jY2xvc2VtZVxyXG4gICAqIEBmaXJlcyBEcm9wZG93biNzaG93XHJcbiAgICovXHJcbiAgb3BlbigpIHtcclxuICAgIC8vIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHRvIGNsb3NlIG90aGVyIG9wZW4gZHJvcGRvd25zXHJcbiAgICAgKiBAZXZlbnQgRHJvcGRvd24jY2xvc2VtZVxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2Nsb3NlbWUuemYuZHJvcGRvd24nLCB0aGlzLiRlbGVtZW50LmF0dHIoJ2lkJykpO1xyXG4gICAgdGhpcy4kYW5jaG9yLmFkZENsYXNzKCdob3ZlcicpXHJcbiAgICAgICAgLmF0dHIoeydhcmlhLWV4cGFuZGVkJzogdHJ1ZX0pO1xyXG4gICAgLy8gdGhpcy4kZWxlbWVudC8qLnNob3coKSovO1xyXG4gICAgdGhpcy5fc2V0UG9zaXRpb24oKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3MoJ2lzLW9wZW4nKVxyXG4gICAgICAgIC5hdHRyKHsnYXJpYS1oaWRkZW4nOiBmYWxzZX0pO1xyXG5cclxuICAgIGlmKHRoaXMub3B0aW9ucy5hdXRvRm9jdXMpe1xyXG4gICAgICB2YXIgJGZvY3VzYWJsZSA9IEZvdW5kYXRpb24uS2V5Ym9hcmQuZmluZEZvY3VzYWJsZSh0aGlzLiRlbGVtZW50KTtcclxuICAgICAgaWYoJGZvY3VzYWJsZS5sZW5ndGgpe1xyXG4gICAgICAgICRmb2N1c2FibGUuZXEoMCkuZm9jdXMoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmKHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2speyB0aGlzLl9hZGRCb2R5SGFuZGxlcigpOyB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy50cmFwRm9jdXMpIHtcclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC50cmFwRm9jdXModGhpcy4kZWxlbWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyBvbmNlIHRoZSBkcm9wZG93biBpcyB2aXNpYmxlLlxyXG4gICAgICogQGV2ZW50IERyb3Bkb3duI3Nob3dcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdzaG93LnpmLmRyb3Bkb3duJywgW3RoaXMuJGVsZW1lbnRdKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb3NlcyB0aGUgb3BlbiBkcm9wZG93biBwYW5lLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBEcm9wZG93biNoaWRlXHJcbiAgICovXHJcbiAgY2xvc2UoKSB7XHJcbiAgICBpZighdGhpcy4kZWxlbWVudC5oYXNDbGFzcygnaXMtb3BlbicpKXtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcygnaXMtb3BlbicpXHJcbiAgICAgICAgLmF0dHIoeydhcmlhLWhpZGRlbic6IHRydWV9KTtcclxuXHJcbiAgICB0aGlzLiRhbmNob3IucmVtb3ZlQ2xhc3MoJ2hvdmVyJylcclxuICAgICAgICAuYXR0cignYXJpYS1leHBhbmRlZCcsIGZhbHNlKTtcclxuXHJcbiAgICBpZih0aGlzLmNsYXNzQ2hhbmdlZCl7XHJcbiAgICAgIHZhciBjdXJQb3NpdGlvbkNsYXNzID0gdGhpcy5nZXRQb3NpdGlvbkNsYXNzKCk7XHJcbiAgICAgIGlmKGN1clBvc2l0aW9uQ2xhc3Mpe1xyXG4gICAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MoY3VyUG9zaXRpb25DbGFzcyk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMucG9zaXRpb25DbGFzcylcclxuICAgICAgICAgIC8qLmhpZGUoKSovLmNzcyh7aGVpZ2h0OiAnJywgd2lkdGg6ICcnfSk7XHJcbiAgICAgIHRoaXMuY2xhc3NDaGFuZ2VkID0gZmFsc2U7XHJcbiAgICAgIHRoaXMuY291bnRlciA9IDQ7XHJcbiAgICAgIHRoaXMudXNlZFBvc2l0aW9ucy5sZW5ndGggPSAwO1xyXG4gICAgfVxyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdoaWRlLnpmLmRyb3Bkb3duJywgW3RoaXMuJGVsZW1lbnRdKTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnRyYXBGb2N1cykge1xyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlbGVhc2VGb2N1cyh0aGlzLiRlbGVtZW50KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZXMgdGhlIGRyb3Bkb3duIHBhbmUncyB2aXNpYmlsaXR5LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHRvZ2dsZSgpIHtcclxuICAgIGlmKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2lzLW9wZW4nKSl7XHJcbiAgICAgIGlmKHRoaXMuJGFuY2hvci5kYXRhKCdob3ZlcicpKSByZXR1cm47XHJcbiAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgIH1lbHNle1xyXG4gICAgICB0aGlzLm9wZW4oKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBkcm9wZG93bi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi50cmlnZ2VyJykuaGlkZSgpO1xyXG4gICAgdGhpcy4kYW5jaG9yLm9mZignLnpmLmRyb3Bkb3duJyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuRHJvcGRvd24uZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgdGhhdCBkZXNpZ25hdGVzIGJvdW5kaW5nIGNvbnRhaW5lciBvZiBEcm9wZG93biAoRGVmYXVsdDogd2luZG93KVxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnZHJvcGRvd24tcGFyZW50J1xyXG4gICAqL1xyXG4gIHBhcmVudENsYXNzOiBudWxsLFxyXG4gIC8qKlxyXG4gICAqIEFtb3VudCBvZiB0aW1lIHRvIGRlbGF5IG9wZW5pbmcgYSBzdWJtZW51IG9uIGhvdmVyIGV2ZW50LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAyNTBcclxuICAgKi9cclxuICBob3ZlckRlbGF5OiAyNTAsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgc3VibWVudXMgdG8gb3BlbiBvbiBob3ZlciBldmVudHNcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBob3ZlcjogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogRG9uJ3QgY2xvc2UgZHJvcGRvd24gd2hlbiBob3ZlcmluZyBvdmVyIGRyb3Bkb3duIHBhbmVcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGhvdmVyUGFuZTogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogTnVtYmVyIG9mIHBpeGVscyBiZXR3ZWVuIHRoZSBkcm9wZG93biBwYW5lIGFuZCB0aGUgdHJpZ2dlcmluZyBlbGVtZW50IG9uIG9wZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDFcclxuICAgKi9cclxuICB2T2Zmc2V0OiAxLFxyXG4gIC8qKlxyXG4gICAqIE51bWJlciBvZiBwaXhlbHMgYmV0d2VlbiB0aGUgZHJvcGRvd24gcGFuZSBhbmQgdGhlIHRyaWdnZXJpbmcgZWxlbWVudCBvbiBvcGVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxXHJcbiAgICovXHJcbiAgaE9mZnNldDogMSxcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIGFkanVzdCBvcGVuIHBvc2l0aW9uLiBKUyB3aWxsIHRlc3QgYW5kIGZpbGwgdGhpcyBpbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3RvcCdcclxuICAgKi9cclxuICBwb3NpdGlvbkNsYXNzOiAnJyxcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgcGx1Z2luIHRvIHRyYXAgZm9jdXMgdG8gdGhlIGRyb3Bkb3duIHBhbmUgaWYgb3BlbmVkIHdpdGgga2V5Ym9hcmQgY29tbWFuZHMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgdHJhcEZvY3VzOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgcGx1Z2luIHRvIHNldCBmb2N1cyB0byB0aGUgZmlyc3QgZm9jdXNhYmxlIGVsZW1lbnQgd2l0aGluIHRoZSBwYW5lLCByZWdhcmRsZXNzIG9mIG1ldGhvZCBvZiBvcGVuaW5nLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgYXV0b0ZvY3VzOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvd3MgYSBjbGljayBvbiB0aGUgYm9keSB0byBjbG9zZSB0aGUgZHJvcGRvd24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgY2xvc2VPbkNsaWNrOiBmYWxzZVxyXG59XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihEcm9wZG93biwgJ0Ryb3Bkb3duJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogRHJvcGRvd25NZW51IG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmRyb3Bkb3duLW1lbnVcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmJveFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm5lc3RcclxuICovXHJcblxyXG5jbGFzcyBEcm9wZG93bk1lbnUge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgRHJvcGRvd25NZW51LlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBEcm9wZG93bk1lbnUjaW5pdFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYSBkcm9wZG93biBtZW51LlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBEcm9wZG93bk1lbnUuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLk5lc3QuRmVhdGhlcih0aGlzLiRlbGVtZW50LCAnZHJvcGRvd24nKTtcclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdEcm9wZG93bk1lbnUnKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ0Ryb3Bkb3duTWVudScsIHtcclxuICAgICAgJ0VOVEVSJzogJ29wZW4nLFxyXG4gICAgICAnU1BBQ0UnOiAnb3BlbicsXHJcbiAgICAgICdBUlJPV19SSUdIVCc6ICduZXh0JyxcclxuICAgICAgJ0FSUk9XX1VQJzogJ3VwJyxcclxuICAgICAgJ0FSUk9XX0RPV04nOiAnZG93bicsXHJcbiAgICAgICdBUlJPV19MRUZUJzogJ3ByZXZpb3VzJyxcclxuICAgICAgJ0VTQ0FQRSc6ICdjbG9zZSdcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIHBsdWdpbiwgYW5kIGNhbGxzIF9wcmVwYXJlTWVudVxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgc3VicyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnbGkuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4oJy5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpLmNoaWxkcmVuKCcuaXMtZHJvcGRvd24tc3VibWVudScpLmFkZENsYXNzKCdmaXJzdC1zdWInKTtcclxuXHJcbiAgICB0aGlzLiRtZW51SXRlbXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tyb2xlPVwibWVudWl0ZW1cIl0nKTtcclxuICAgIHRoaXMuJHRhYnMgPSB0aGlzLiRlbGVtZW50LmNoaWxkcmVuKCdbcm9sZT1cIm1lbnVpdGVtXCJdJyk7XHJcbiAgICB0aGlzLiR0YWJzLmZpbmQoJ3VsLmlzLWRyb3Bkb3duLXN1Ym1lbnUnKS5hZGRDbGFzcyh0aGlzLm9wdGlvbnMudmVydGljYWxDbGFzcyk7XHJcblxyXG4gICAgaWYgKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3ModGhpcy5vcHRpb25zLnJpZ2h0Q2xhc3MpIHx8IHRoaXMub3B0aW9ucy5hbGlnbm1lbnQgPT09ICdyaWdodCcgfHwgRm91bmRhdGlvbi5ydGwoKSB8fCB0aGlzLiRlbGVtZW50LnBhcmVudHMoJy50b3AtYmFyLXJpZ2h0JykuaXMoJyonKSkge1xyXG4gICAgICB0aGlzLm9wdGlvbnMuYWxpZ25tZW50ID0gJ3JpZ2h0JztcclxuICAgICAgc3Vicy5hZGRDbGFzcygnb3BlbnMtbGVmdCcpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc3Vicy5hZGRDbGFzcygnb3BlbnMtcmlnaHQnKTtcclxuICAgIH1cclxuICAgIHRoaXMuY2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfTtcclxuXHJcbiAgX2lzVmVydGljYWwoKSB7XHJcbiAgICByZXR1cm4gdGhpcy4kdGFicy5jc3MoJ2Rpc3BsYXknKSA9PT0gJ2Jsb2NrJztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIHRvIGVsZW1lbnRzIHdpdGhpbiB0aGUgbWVudVxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgaGFzVG91Y2ggPSAnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cgfHwgKHR5cGVvZiB3aW5kb3cub250b3VjaHN0YXJ0ICE9PSAndW5kZWZpbmVkJyksXHJcbiAgICAgICAgcGFyQ2xhc3MgPSAnaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnO1xyXG5cclxuICAgIC8vIHVzZWQgZm9yIG9uQ2xpY2sgYW5kIGluIHRoZSBrZXlib2FyZCBoYW5kbGVyc1xyXG4gICAgdmFyIGhhbmRsZUNsaWNrRm4gPSBmdW5jdGlvbihlKSB7XHJcbiAgICAgIHZhciAkZWxlbSA9ICQoZS50YXJnZXQpLnBhcmVudHNVbnRpbCgndWwnLCBgLiR7cGFyQ2xhc3N9YCksXHJcbiAgICAgICAgICBoYXNTdWIgPSAkZWxlbS5oYXNDbGFzcyhwYXJDbGFzcyksXHJcbiAgICAgICAgICBoYXNDbGlja2VkID0gJGVsZW0uYXR0cignZGF0YS1pcy1jbGljaycpID09PSAndHJ1ZScsXHJcbiAgICAgICAgICAkc3ViID0gJGVsZW0uY2hpbGRyZW4oJy5pcy1kcm9wZG93bi1zdWJtZW51Jyk7XHJcblxyXG4gICAgICBpZiAoaGFzU3ViKSB7XHJcbiAgICAgICAgaWYgKGhhc0NsaWNrZWQpIHtcclxuICAgICAgICAgIGlmICghX3RoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgfHwgKCFfdGhpcy5vcHRpb25zLmNsaWNrT3BlbiAmJiAhaGFzVG91Y2gpIHx8IChfdGhpcy5vcHRpb25zLmZvcmNlRm9sbG93ICYmIGhhc1RvdWNoKSkgeyByZXR1cm47IH1cclxuICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIF90aGlzLl9oaWRlKCRlbGVtKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgIF90aGlzLl9zaG93KCRzdWIpO1xyXG4gICAgICAgICAgJGVsZW0uYWRkKCRlbGVtLnBhcmVudHNVbnRpbChfdGhpcy4kZWxlbWVudCwgYC4ke3BhckNsYXNzfWApKS5hdHRyKCdkYXRhLWlzLWNsaWNrJywgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xpY2tPcGVuIHx8IGhhc1RvdWNoKSB7XHJcbiAgICAgIHRoaXMuJG1lbnVJdGVtcy5vbignY2xpY2suemYuZHJvcGRvd25tZW51IHRvdWNoc3RhcnQuemYuZHJvcGRvd25tZW51JywgaGFuZGxlQ2xpY2tGbik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSGFuZGxlIExlYWYgZWxlbWVudCBDbGlja3NcclxuICAgIGlmKF90aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrSW5zaWRlKXtcclxuICAgICAgdGhpcy4kbWVudUl0ZW1zLm9uKCdjbGljay56Zi5kcm9wZG93bm1lbnUgdG91Y2hlbmQuemYuZHJvcGRvd25tZW51JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciAkZWxlbSA9ICQodGhpcyksXHJcbiAgICAgICAgICAgIGhhc1N1YiA9ICRlbGVtLmhhc0NsYXNzKHBhckNsYXNzKTtcclxuICAgICAgICBpZighaGFzU3ViKXtcclxuICAgICAgICAgIF90aGlzLl9oaWRlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5kaXNhYmxlSG92ZXIpIHtcclxuICAgICAgdGhpcy4kbWVudUl0ZW1zLm9uKCdtb3VzZWVudGVyLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICB2YXIgJGVsZW0gPSAkKHRoaXMpLFxyXG4gICAgICAgICAgICBoYXNTdWIgPSAkZWxlbS5oYXNDbGFzcyhwYXJDbGFzcyk7XHJcblxyXG4gICAgICAgIGlmIChoYXNTdWIpIHtcclxuICAgICAgICAgIGNsZWFyVGltZW91dCgkZWxlbS5kYXRhKCdfZGVsYXknKSk7XHJcbiAgICAgICAgICAkZWxlbS5kYXRhKCdfZGVsYXknLCBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBfdGhpcy5fc2hvdygkZWxlbS5jaGlsZHJlbignLmlzLWRyb3Bkb3duLXN1Ym1lbnUnKSk7XHJcbiAgICAgICAgICB9LCBfdGhpcy5vcHRpb25zLmhvdmVyRGVsYXkpKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pLm9uKCdtb3VzZWxlYXZlLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICB2YXIgJGVsZW0gPSAkKHRoaXMpLFxyXG4gICAgICAgICAgICBoYXNTdWIgPSAkZWxlbS5oYXNDbGFzcyhwYXJDbGFzcyk7XHJcbiAgICAgICAgaWYgKGhhc1N1YiAmJiBfdGhpcy5vcHRpb25zLmF1dG9jbG9zZSkge1xyXG4gICAgICAgICAgaWYgKCRlbGVtLmF0dHIoJ2RhdGEtaXMtY2xpY2snKSA9PT0gJ3RydWUnICYmIF90aGlzLm9wdGlvbnMuY2xpY2tPcGVuKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuICAgICAgICAgIGNsZWFyVGltZW91dCgkZWxlbS5kYXRhKCdfZGVsYXknKSk7XHJcbiAgICAgICAgICAkZWxlbS5kYXRhKCdfZGVsYXknLCBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBfdGhpcy5faGlkZSgkZWxlbSk7XHJcbiAgICAgICAgICB9LCBfdGhpcy5vcHRpb25zLmNsb3NpbmdUaW1lKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIHRoaXMuJG1lbnVJdGVtcy5vbigna2V5ZG93bi56Zi5kcm9wZG93bm1lbnUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIHZhciAkZWxlbWVudCA9ICQoZS50YXJnZXQpLnBhcmVudHNVbnRpbCgndWwnLCAnW3JvbGU9XCJtZW51aXRlbVwiXScpLFxyXG4gICAgICAgICAgaXNUYWIgPSBfdGhpcy4kdGFicy5pbmRleCgkZWxlbWVudCkgPiAtMSxcclxuICAgICAgICAgICRlbGVtZW50cyA9IGlzVGFiID8gX3RoaXMuJHRhYnMgOiAkZWxlbWVudC5zaWJsaW5ncygnbGknKS5hZGQoJGVsZW1lbnQpLFxyXG4gICAgICAgICAgJHByZXZFbGVtZW50LFxyXG4gICAgICAgICAgJG5leHRFbGVtZW50O1xyXG5cclxuICAgICAgJGVsZW1lbnRzLmVhY2goZnVuY3Rpb24oaSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLmlzKCRlbGVtZW50KSkge1xyXG4gICAgICAgICAgJHByZXZFbGVtZW50ID0gJGVsZW1lbnRzLmVxKGktMSk7XHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQgPSAkZWxlbWVudHMuZXEoaSsxKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgdmFyIG5leHRTaWJsaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaWYgKCEkZWxlbWVudC5pcygnOmxhc3QtY2hpbGQnKSkge1xyXG4gICAgICAgICAgJG5leHRFbGVtZW50LmNoaWxkcmVuKCdhOmZpcnN0JykuZm9jdXMoKTtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sIHByZXZTaWJsaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgJHByZXZFbGVtZW50LmNoaWxkcmVuKCdhOmZpcnN0JykuZm9jdXMoKTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIH0sIG9wZW5TdWIgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgJHN1YiA9ICRlbGVtZW50LmNoaWxkcmVuKCd1bC5pcy1kcm9wZG93bi1zdWJtZW51Jyk7XHJcbiAgICAgICAgaWYgKCRzdWIubGVuZ3RoKSB7XHJcbiAgICAgICAgICBfdGhpcy5fc2hvdygkc3ViKTtcclxuICAgICAgICAgICRlbGVtZW50LmZpbmQoJ2xpID4gYTpmaXJzdCcpLmZvY3VzKCk7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgfSBlbHNlIHsgcmV0dXJuOyB9XHJcbiAgICAgIH0sIGNsb3NlU3ViID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgLy9pZiAoJGVsZW1lbnQuaXMoJzpmaXJzdC1jaGlsZCcpKSB7XHJcbiAgICAgICAgdmFyIGNsb3NlID0gJGVsZW1lbnQucGFyZW50KCd1bCcpLnBhcmVudCgnbGknKTtcclxuICAgICAgICBjbG9zZS5jaGlsZHJlbignYTpmaXJzdCcpLmZvY3VzKCk7XHJcbiAgICAgICAgX3RoaXMuX2hpZGUoY2xvc2UpO1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAvL31cclxuICAgICAgfTtcclxuICAgICAgdmFyIGZ1bmN0aW9ucyA9IHtcclxuICAgICAgICBvcGVuOiBvcGVuU3ViLFxyXG4gICAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIF90aGlzLl9oaWRlKF90aGlzLiRlbGVtZW50KTtcclxuICAgICAgICAgIF90aGlzLiRtZW51SXRlbXMuZmluZCgnYTpmaXJzdCcpLmZvY3VzKCk7IC8vIGZvY3VzIHRvIGZpcnN0IGVsZW1lbnRcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBpZiAoaXNUYWIpIHtcclxuICAgICAgICBpZiAoX3RoaXMuX2lzVmVydGljYWwoKSkgeyAvLyB2ZXJ0aWNhbCBtZW51XHJcbiAgICAgICAgICBpZiAoRm91bmRhdGlvbi5ydGwoKSkgeyAvLyByaWdodCBhbGlnbmVkXHJcbiAgICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xyXG4gICAgICAgICAgICAgIGRvd246IG5leHRTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIHVwOiBwcmV2U2libGluZyxcclxuICAgICAgICAgICAgICBuZXh0OiBjbG9zZVN1YixcclxuICAgICAgICAgICAgICBwcmV2aW91czogb3BlblN1YlxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0gZWxzZSB7IC8vIGxlZnQgYWxpZ25lZFxyXG4gICAgICAgICAgICAkLmV4dGVuZChmdW5jdGlvbnMsIHtcclxuICAgICAgICAgICAgICBkb3duOiBuZXh0U2libGluZyxcclxuICAgICAgICAgICAgICB1cDogcHJldlNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgbmV4dDogb3BlblN1YixcclxuICAgICAgICAgICAgICBwcmV2aW91czogY2xvc2VTdWJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gaG9yaXpvbnRhbCBtZW51XHJcbiAgICAgICAgICBpZiAoRm91bmRhdGlvbi5ydGwoKSkgeyAvLyByaWdodCBhbGlnbmVkXHJcbiAgICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xyXG4gICAgICAgICAgICAgIG5leHQ6IHByZXZTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIHByZXZpb3VzOiBuZXh0U2libGluZyxcclxuICAgICAgICAgICAgICBkb3duOiBvcGVuU3ViLFxyXG4gICAgICAgICAgICAgIHVwOiBjbG9zZVN1YlxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0gZWxzZSB7IC8vIGxlZnQgYWxpZ25lZFxyXG4gICAgICAgICAgICAkLmV4dGVuZChmdW5jdGlvbnMsIHtcclxuICAgICAgICAgICAgICBuZXh0OiBuZXh0U2libGluZyxcclxuICAgICAgICAgICAgICBwcmV2aW91czogcHJldlNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgZG93bjogb3BlblN1YixcclxuICAgICAgICAgICAgICB1cDogY2xvc2VTdWJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgeyAvLyBub3QgdGFicyAtPiBvbmUgc3ViXHJcbiAgICAgICAgaWYgKEZvdW5kYXRpb24ucnRsKCkpIHsgLy8gcmlnaHQgYWxpZ25lZFxyXG4gICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XHJcbiAgICAgICAgICAgIG5leHQ6IGNsb3NlU3ViLFxyXG4gICAgICAgICAgICBwcmV2aW91czogb3BlblN1YixcclxuICAgICAgICAgICAgZG93bjogbmV4dFNpYmxpbmcsXHJcbiAgICAgICAgICAgIHVwOiBwcmV2U2libGluZ1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gbGVmdCBhbGlnbmVkXHJcbiAgICAgICAgICAkLmV4dGVuZChmdW5jdGlvbnMsIHtcclxuICAgICAgICAgICAgbmV4dDogb3BlblN1YixcclxuICAgICAgICAgICAgcHJldmlvdXM6IGNsb3NlU3ViLFxyXG4gICAgICAgICAgICBkb3duOiBuZXh0U2libGluZyxcclxuICAgICAgICAgICAgdXA6IHByZXZTaWJsaW5nXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ0Ryb3Bkb3duTWVudScsIGZ1bmN0aW9ucyk7XHJcblxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGFuIGV2ZW50IGhhbmRsZXIgdG8gdGhlIGJvZHkgdG8gY2xvc2UgYW55IGRyb3Bkb3ducyBvbiBhIGNsaWNrLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2FkZEJvZHlIYW5kbGVyKCkge1xyXG4gICAgdmFyICRib2R5ID0gJChkb2N1bWVudC5ib2R5KSxcclxuICAgICAgICBfdGhpcyA9IHRoaXM7XHJcbiAgICAkYm9keS5vZmYoJ21vdXNldXAuemYuZHJvcGRvd25tZW51IHRvdWNoZW5kLnpmLmRyb3Bkb3dubWVudScpXHJcbiAgICAgICAgIC5vbignbW91c2V1cC56Zi5kcm9wZG93bm1lbnUgdG91Y2hlbmQuemYuZHJvcGRvd25tZW51JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgIHZhciAkbGluayA9IF90aGlzLiRlbGVtZW50LmZpbmQoZS50YXJnZXQpO1xyXG4gICAgICAgICAgIGlmICgkbGluay5sZW5ndGgpIHsgcmV0dXJuOyB9XHJcblxyXG4gICAgICAgICAgIF90aGlzLl9oaWRlKCk7XHJcbiAgICAgICAgICAgJGJvZHkub2ZmKCdtb3VzZXVwLnpmLmRyb3Bkb3dubWVudSB0b3VjaGVuZC56Zi5kcm9wZG93bm1lbnUnKTtcclxuICAgICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyBhIGRyb3Bkb3duIHBhbmUsIGFuZCBjaGVja3MgZm9yIGNvbGxpc2lvbnMgZmlyc3QuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRzdWIgLSB1bCBlbGVtZW50IHRoYXQgaXMgYSBzdWJtZW51IHRvIHNob3dcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBmaXJlcyBEcm9wZG93bk1lbnUjc2hvd1xyXG4gICAqL1xyXG4gIF9zaG93KCRzdWIpIHtcclxuICAgIHZhciBpZHggPSB0aGlzLiR0YWJzLmluZGV4KHRoaXMuJHRhYnMuZmlsdGVyKGZ1bmN0aW9uKGksIGVsKSB7XHJcbiAgICAgIHJldHVybiAkKGVsKS5maW5kKCRzdWIpLmxlbmd0aCA+IDA7XHJcbiAgICB9KSk7XHJcbiAgICB2YXIgJHNpYnMgPSAkc3ViLnBhcmVudCgnbGkuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKS5zaWJsaW5ncygnbGkuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKTtcclxuICAgIHRoaXMuX2hpZGUoJHNpYnMsIGlkeCk7XHJcbiAgICAkc3ViLmNzcygndmlzaWJpbGl0eScsICdoaWRkZW4nKS5hZGRDbGFzcygnanMtZHJvcGRvd24tYWN0aXZlJylcclxuICAgICAgICAucGFyZW50KCdsaS5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpLmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcclxuICAgIHZhciBjbGVhciA9IEZvdW5kYXRpb24uQm94LkltTm90VG91Y2hpbmdZb3UoJHN1YiwgbnVsbCwgdHJ1ZSk7XHJcbiAgICBpZiAoIWNsZWFyKSB7XHJcbiAgICAgIHZhciBvbGRDbGFzcyA9IHRoaXMub3B0aW9ucy5hbGlnbm1lbnQgPT09ICdsZWZ0JyA/ICctcmlnaHQnIDogJy1sZWZ0JyxcclxuICAgICAgICAgICRwYXJlbnRMaSA9ICRzdWIucGFyZW50KCcuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKTtcclxuICAgICAgJHBhcmVudExpLnJlbW92ZUNsYXNzKGBvcGVucyR7b2xkQ2xhc3N9YCkuYWRkQ2xhc3MoYG9wZW5zLSR7dGhpcy5vcHRpb25zLmFsaWdubWVudH1gKTtcclxuICAgICAgY2xlYXIgPSBGb3VuZGF0aW9uLkJveC5JbU5vdFRvdWNoaW5nWW91KCRzdWIsIG51bGwsIHRydWUpO1xyXG4gICAgICBpZiAoIWNsZWFyKSB7XHJcbiAgICAgICAgJHBhcmVudExpLnJlbW92ZUNsYXNzKGBvcGVucy0ke3RoaXMub3B0aW9ucy5hbGlnbm1lbnR9YCkuYWRkQ2xhc3MoJ29wZW5zLWlubmVyJyk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5jaGFuZ2VkID0gdHJ1ZTtcclxuICAgIH1cclxuICAgICRzdWIuY3NzKCd2aXNpYmlsaXR5JywgJycpO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2spIHsgdGhpcy5fYWRkQm9keUhhbmRsZXIoKTsgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBuZXcgZHJvcGRvd24gcGFuZSBpcyB2aXNpYmxlLlxyXG4gICAgICogQGV2ZW50IERyb3Bkb3duTWVudSNzaG93XHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignc2hvdy56Zi5kcm9wZG93bm1lbnUnLCBbJHN1Yl0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGlkZXMgYSBzaW5nbGUsIGN1cnJlbnRseSBvcGVuIGRyb3Bkb3duIHBhbmUsIGlmIHBhc3NlZCBhIHBhcmFtZXRlciwgb3RoZXJ3aXNlLCBoaWRlcyBldmVyeXRoaW5nLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxlbSAtIGVsZW1lbnQgd2l0aCBhIHN1Ym1lbnUgdG8gaGlkZVxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpZHggLSBpbmRleCBvZiB0aGUgJHRhYnMgY29sbGVjdGlvbiB0byBoaWRlXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaGlkZSgkZWxlbSwgaWR4KSB7XHJcbiAgICB2YXIgJHRvQ2xvc2U7XHJcbiAgICBpZiAoJGVsZW0gJiYgJGVsZW0ubGVuZ3RoKSB7XHJcbiAgICAgICR0b0Nsb3NlID0gJGVsZW07XHJcbiAgICB9IGVsc2UgaWYgKGlkeCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICR0b0Nsb3NlID0gdGhpcy4kdGFicy5ub3QoZnVuY3Rpb24oaSwgZWwpIHtcclxuICAgICAgICByZXR1cm4gaSA9PT0gaWR4O1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAkdG9DbG9zZSA9IHRoaXMuJGVsZW1lbnQ7XHJcbiAgICB9XHJcbiAgICB2YXIgc29tZXRoaW5nVG9DbG9zZSA9ICR0b0Nsb3NlLmhhc0NsYXNzKCdpcy1hY3RpdmUnKSB8fCAkdG9DbG9zZS5maW5kKCcuaXMtYWN0aXZlJykubGVuZ3RoID4gMDtcclxuXHJcbiAgICBpZiAoc29tZXRoaW5nVG9DbG9zZSkge1xyXG4gICAgICAkdG9DbG9zZS5maW5kKCdsaS5pcy1hY3RpdmUnKS5hZGQoJHRvQ2xvc2UpLmF0dHIoe1xyXG4gICAgICAgICdkYXRhLWlzLWNsaWNrJzogZmFsc2VcclxuICAgICAgfSkucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZScpO1xyXG5cclxuICAgICAgJHRvQ2xvc2UuZmluZCgndWwuanMtZHJvcGRvd24tYWN0aXZlJykucmVtb3ZlQ2xhc3MoJ2pzLWRyb3Bkb3duLWFjdGl2ZScpO1xyXG5cclxuICAgICAgaWYgKHRoaXMuY2hhbmdlZCB8fCAkdG9DbG9zZS5maW5kKCdvcGVucy1pbm5lcicpLmxlbmd0aCkge1xyXG4gICAgICAgIHZhciBvbGRDbGFzcyA9IHRoaXMub3B0aW9ucy5hbGlnbm1lbnQgPT09ICdsZWZ0JyA/ICdyaWdodCcgOiAnbGVmdCc7XHJcbiAgICAgICAgJHRvQ2xvc2UuZmluZCgnbGkuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKS5hZGQoJHRvQ2xvc2UpXHJcbiAgICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoYG9wZW5zLWlubmVyIG9wZW5zLSR7dGhpcy5vcHRpb25zLmFsaWdubWVudH1gKVxyXG4gICAgICAgICAgICAgICAgLmFkZENsYXNzKGBvcGVucy0ke29sZENsYXNzfWApO1xyXG4gICAgICAgIHRoaXMuY2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBGaXJlcyB3aGVuIHRoZSBvcGVuIG1lbnVzIGFyZSBjbG9zZWQuXHJcbiAgICAgICAqIEBldmVudCBEcm9wZG93bk1lbnUjaGlkZVxyXG4gICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdoaWRlLnpmLmRyb3Bkb3dubWVudScsIFskdG9DbG9zZV0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIHBsdWdpbi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kbWVudUl0ZW1zLm9mZignLnpmLmRyb3Bkb3dubWVudScpLnJlbW92ZUF0dHIoJ2RhdGEtaXMtY2xpY2snKVxyXG4gICAgICAgIC5yZW1vdmVDbGFzcygnaXMtcmlnaHQtYXJyb3cgaXMtbGVmdC1hcnJvdyBpcy1kb3duLWFycm93IG9wZW5zLXJpZ2h0IG9wZW5zLWxlZnQgb3BlbnMtaW5uZXInKTtcclxuICAgICQoZG9jdW1lbnQuYm9keSkub2ZmKCcuemYuZHJvcGRvd25tZW51Jyk7XHJcbiAgICBGb3VuZGF0aW9uLk5lc3QuQnVybih0aGlzLiRlbGVtZW50LCAnZHJvcGRvd24nKTtcclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZWZhdWx0IHNldHRpbmdzIGZvciBwbHVnaW5cclxuICovXHJcbkRyb3Bkb3duTWVudS5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBEaXNhbGxvd3MgaG92ZXIgZXZlbnRzIGZyb20gb3BlbmluZyBzdWJtZW51c1xyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGRpc2FibGVIb3ZlcjogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgYSBzdWJtZW51IHRvIGF1dG9tYXRpY2FsbHkgY2xvc2Ugb24gYSBtb3VzZWxlYXZlIGV2ZW50LCBpZiBub3QgY2xpY2tlZCBvcGVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgYXV0b2Nsb3NlOiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIEFtb3VudCBvZiB0aW1lIHRvIGRlbGF5IG9wZW5pbmcgYSBzdWJtZW51IG9uIGhvdmVyIGV2ZW50LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MFxyXG4gICAqL1xyXG4gIGhvdmVyRGVsYXk6IDUwLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IGEgc3VibWVudSB0byBvcGVuL3JlbWFpbiBvcGVuIG9uIHBhcmVudCBjbGljayBldmVudC4gQWxsb3dzIGN1cnNvciB0byBtb3ZlIGF3YXkgZnJvbSBtZW51LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xpY2tPcGVuOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbW91bnQgb2YgdGltZSB0byBkZWxheSBjbG9zaW5nIGEgc3VibWVudSBvbiBhIG1vdXNlbGVhdmUgZXZlbnQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwMFxyXG4gICAqL1xyXG5cclxuICBjbG9zaW5nVGltZTogNTAwLFxyXG4gIC8qKlxyXG4gICAqIFBvc2l0aW9uIG9mIHRoZSBtZW51IHJlbGF0aXZlIHRvIHdoYXQgZGlyZWN0aW9uIHRoZSBzdWJtZW51cyBzaG91bGQgb3Blbi4gSGFuZGxlZCBieSBKUy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2xlZnQnXHJcbiAgICovXHJcbiAgYWxpZ25tZW50OiAnbGVmdCcsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgY2xpY2tzIG9uIHRoZSBib2R5IHRvIGNsb3NlIGFueSBvcGVuIHN1Ym1lbnVzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xvc2VPbkNsaWNrOiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IGNsaWNrcyBvbiBsZWFmIGFuY2hvciBsaW5rcyB0byBjbG9zZSBhbnkgb3BlbiBzdWJtZW51cy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsb3NlT25DbGlja0luc2lkZTogdHJ1ZSxcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHZlcnRpY2FsIG9yaWVudGVkIG1lbnVzLCBGb3VuZGF0aW9uIGRlZmF1bHQgaXMgYHZlcnRpY2FsYC4gVXBkYXRlIHRoaXMgaWYgdXNpbmcgeW91ciBvd24gY2xhc3MuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICd2ZXJ0aWNhbCdcclxuICAgKi9cclxuICB2ZXJ0aWNhbENsYXNzOiAndmVydGljYWwnLFxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gcmlnaHQtc2lkZSBvcmllbnRlZCBtZW51cywgRm91bmRhdGlvbiBkZWZhdWx0IGlzIGBhbGlnbi1yaWdodGAuIFVwZGF0ZSB0aGlzIGlmIHVzaW5nIHlvdXIgb3duIGNsYXNzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnYWxpZ24tcmlnaHQnXHJcbiAgICovXHJcbiAgcmlnaHRDbGFzczogJ2FsaWduLXJpZ2h0JyxcclxuICAvKipcclxuICAgKiBCb29sZWFuIHRvIGZvcmNlIG92ZXJpZGUgdGhlIGNsaWNraW5nIG9mIGxpbmtzIHRvIHBlcmZvcm0gZGVmYXVsdCBhY3Rpb24sIG9uIHNlY29uZCB0b3VjaCBldmVudCBmb3IgbW9iaWxlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGZvcmNlRm9sbG93OiB0cnVlXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihEcm9wZG93bk1lbnUsICdEcm9wZG93bk1lbnUnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBFcXVhbGl6ZXIgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uZXF1YWxpemVyXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRpbWVyQW5kSW1hZ2VMb2FkZXIgaWYgZXF1YWxpemVyIGNvbnRhaW5zIGltYWdlc1xyXG4gKi9cclxuXHJcbmNsYXNzIEVxdWFsaXplciB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBFcXVhbGl6ZXIuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIEVxdWFsaXplciNpbml0XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGFkZCB0aGUgdHJpZ2dlciB0by5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucyl7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyAgPSAkLmV4dGVuZCh7fSwgRXF1YWxpemVyLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0VxdWFsaXplcicpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIEVxdWFsaXplciBwbHVnaW4gYW5kIGNhbGxzIGZ1bmN0aW9ucyB0byBnZXQgZXF1YWxpemVyIGZ1bmN0aW9uaW5nIG9uIGxvYWQuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBlcUlkID0gdGhpcy4kZWxlbWVudC5hdHRyKCdkYXRhLWVxdWFsaXplcicpIHx8ICcnO1xyXG4gICAgdmFyICR3YXRjaGVkID0gdGhpcy4kZWxlbWVudC5maW5kKGBbZGF0YS1lcXVhbGl6ZXItd2F0Y2g9XCIke2VxSWR9XCJdYCk7XHJcblxyXG4gICAgdGhpcy4kd2F0Y2hlZCA9ICR3YXRjaGVkLmxlbmd0aCA/ICR3YXRjaGVkIDogdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1lcXVhbGl6ZXItd2F0Y2hdJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2RhdGEtcmVzaXplJywgKGVxSWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnZXEnKSkpO1xyXG5cdHRoaXMuJGVsZW1lbnQuYXR0cignZGF0YS1tdXRhdGUnLCAoZXFJZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdlcScpKSk7XHJcblxyXG4gICAgdGhpcy5oYXNOZXN0ZWQgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLWVxdWFsaXplcl0nKS5sZW5ndGggPiAwO1xyXG4gICAgdGhpcy5pc05lc3RlZCA9IHRoaXMuJGVsZW1lbnQucGFyZW50c1VudGlsKGRvY3VtZW50LmJvZHksICdbZGF0YS1lcXVhbGl6ZXJdJykubGVuZ3RoID4gMDtcclxuICAgIHRoaXMuaXNPbiA9IGZhbHNlO1xyXG4gICAgdGhpcy5fYmluZEhhbmRsZXIgPSB7XHJcbiAgICAgIG9uUmVzaXplTWVCb3VuZDogdGhpcy5fb25SZXNpemVNZS5iaW5kKHRoaXMpLFxyXG4gICAgICBvblBvc3RFcXVhbGl6ZWRCb3VuZDogdGhpcy5fb25Qb3N0RXF1YWxpemVkLmJpbmQodGhpcylcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGltZ3MgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2ltZycpO1xyXG4gICAgdmFyIHRvb1NtYWxsO1xyXG4gICAgaWYodGhpcy5vcHRpb25zLmVxdWFsaXplT24pe1xyXG4gICAgICB0b29TbWFsbCA9IHRoaXMuX2NoZWNrTVEoKTtcclxuICAgICAgJCh3aW5kb3cpLm9uKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCB0aGlzLl9jaGVja01RLmJpbmQodGhpcykpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gICAgfVxyXG4gICAgaWYoKHRvb1NtYWxsICE9PSB1bmRlZmluZWQgJiYgdG9vU21hbGwgPT09IGZhbHNlKSB8fCB0b29TbWFsbCA9PT0gdW5kZWZpbmVkKXtcclxuICAgICAgaWYoaW1ncy5sZW5ndGgpe1xyXG4gICAgICAgIEZvdW5kYXRpb24ub25JbWFnZXNMb2FkZWQoaW1ncywgdGhpcy5fcmVmbG93LmJpbmQodGhpcykpO1xyXG4gICAgICB9ZWxzZXtcclxuICAgICAgICB0aGlzLl9yZWZsb3coKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlcyBldmVudCBsaXN0ZW5lcnMgaWYgdGhlIGJyZWFrcG9pbnQgaXMgdG9vIHNtYWxsLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3BhdXNlRXZlbnRzKCkge1xyXG4gICAgdGhpcy5pc09uID0gZmFsc2U7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZih7XHJcbiAgICAgICcuemYuZXF1YWxpemVyJzogdGhpcy5fYmluZEhhbmRsZXIub25Qb3N0RXF1YWxpemVkQm91bmQsXHJcbiAgICAgICdyZXNpemVtZS56Zi50cmlnZ2VyJzogdGhpcy5fYmluZEhhbmRsZXIub25SZXNpemVNZUJvdW5kLFxyXG5cdCAgJ211dGF0ZW1lLnpmLnRyaWdnZXInOiB0aGlzLl9iaW5kSGFuZGxlci5vblJlc2l6ZU1lQm91bmRcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogZnVuY3Rpb24gdG8gaGFuZGxlICRlbGVtZW50cyByZXNpemVtZS56Zi50cmlnZ2VyLCB3aXRoIGJvdW5kIHRoaXMgb24gX2JpbmRIYW5kbGVyLm9uUmVzaXplTWVCb3VuZFxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX29uUmVzaXplTWUoZSkge1xyXG4gICAgdGhpcy5fcmVmbG93KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBmdW5jdGlvbiB0byBoYW5kbGUgJGVsZW1lbnRzIHBvc3RlcXVhbGl6ZWQuemYuZXF1YWxpemVyLCB3aXRoIGJvdW5kIHRoaXMgb24gX2JpbmRIYW5kbGVyLm9uUG9zdEVxdWFsaXplZEJvdW5kXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfb25Qb3N0RXF1YWxpemVkKGUpIHtcclxuICAgIGlmKGUudGFyZ2V0ICE9PSB0aGlzLiRlbGVtZW50WzBdKXsgdGhpcy5fcmVmbG93KCk7IH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIGV2ZW50cyBmb3IgRXF1YWxpemVyLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLl9wYXVzZUV2ZW50cygpO1xyXG4gICAgaWYodGhpcy5oYXNOZXN0ZWQpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9uKCdwb3N0ZXF1YWxpemVkLnpmLmVxdWFsaXplcicsIHRoaXMuX2JpbmRIYW5kbGVyLm9uUG9zdEVxdWFsaXplZEJvdW5kKTtcclxuICAgIH1lbHNle1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9uKCdyZXNpemVtZS56Zi50cmlnZ2VyJywgdGhpcy5fYmluZEhhbmRsZXIub25SZXNpemVNZUJvdW5kKTtcclxuXHQgIHRoaXMuJGVsZW1lbnQub24oJ211dGF0ZW1lLnpmLnRyaWdnZXInLCB0aGlzLl9iaW5kSGFuZGxlci5vblJlc2l6ZU1lQm91bmQpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5pc09uID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyB0aGUgY3VycmVudCBicmVha3BvaW50IHRvIHRoZSBtaW5pbXVtIHJlcXVpcmVkIHNpemUuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfY2hlY2tNUSgpIHtcclxuICAgIHZhciB0b29TbWFsbCA9ICFGb3VuZGF0aW9uLk1lZGlhUXVlcnkuaXModGhpcy5vcHRpb25zLmVxdWFsaXplT24pO1xyXG4gICAgaWYodG9vU21hbGwpe1xyXG4gICAgICBpZih0aGlzLmlzT24pe1xyXG4gICAgICAgIHRoaXMuX3BhdXNlRXZlbnRzKCk7XHJcbiAgICAgICAgdGhpcy4kd2F0Y2hlZC5jc3MoJ2hlaWdodCcsICdhdXRvJyk7XHJcbiAgICAgIH1cclxuICAgIH1lbHNle1xyXG4gICAgICBpZighdGhpcy5pc09uKXtcclxuICAgICAgICB0aGlzLl9ldmVudHMoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRvb1NtYWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBub29wIHZlcnNpb24gZm9yIHRoZSBwbHVnaW5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9raWxsc3dpdGNoKCkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsbHMgbmVjZXNzYXJ5IGZ1bmN0aW9ucyB0byB1cGRhdGUgRXF1YWxpemVyIHVwb24gRE9NIGNoYW5nZVxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3JlZmxvdygpIHtcclxuICAgIGlmKCF0aGlzLm9wdGlvbnMuZXF1YWxpemVPblN0YWNrKXtcclxuICAgICAgaWYodGhpcy5faXNTdGFja2VkKCkpe1xyXG4gICAgICAgIHRoaXMuJHdhdGNoZWQuY3NzKCdoZWlnaHQnLCAnYXV0bycpO1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5lcXVhbGl6ZUJ5Um93KSB7XHJcbiAgICAgIHRoaXMuZ2V0SGVpZ2h0c0J5Um93KHRoaXMuYXBwbHlIZWlnaHRCeVJvdy5iaW5kKHRoaXMpKTtcclxuICAgIH1lbHNle1xyXG4gICAgICB0aGlzLmdldEhlaWdodHModGhpcy5hcHBseUhlaWdodC5iaW5kKHRoaXMpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1hbnVhbGx5IGRldGVybWluZXMgaWYgdGhlIGZpcnN0IDIgZWxlbWVudHMgYXJlICpOT1QqIHN0YWNrZWQuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaXNTdGFja2VkKCkge1xyXG4gICAgaWYgKCF0aGlzLiR3YXRjaGVkWzBdIHx8ICF0aGlzLiR3YXRjaGVkWzFdKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuJHdhdGNoZWRbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wICE9PSB0aGlzLiR3YXRjaGVkWzFdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbmRzIHRoZSBvdXRlciBoZWlnaHRzIG9mIGNoaWxkcmVuIGNvbnRhaW5lZCB3aXRoaW4gYW4gRXF1YWxpemVyIHBhcmVudCBhbmQgcmV0dXJucyB0aGVtIGluIGFuIGFycmF5XHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBBIG5vbi1vcHRpb25hbCBjYWxsYmFjayB0byByZXR1cm4gdGhlIGhlaWdodHMgYXJyYXkgdG8uXHJcbiAgICogQHJldHVybnMge0FycmF5fSBoZWlnaHRzIC0gQW4gYXJyYXkgb2YgaGVpZ2h0cyBvZiBjaGlsZHJlbiB3aXRoaW4gRXF1YWxpemVyIGNvbnRhaW5lclxyXG4gICAqL1xyXG4gIGdldEhlaWdodHMoY2IpIHtcclxuICAgIHZhciBoZWlnaHRzID0gW107XHJcbiAgICBmb3IodmFyIGkgPSAwLCBsZW4gPSB0aGlzLiR3YXRjaGVkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKXtcclxuICAgICAgdGhpcy4kd2F0Y2hlZFtpXS5zdHlsZS5oZWlnaHQgPSAnYXV0byc7XHJcbiAgICAgIGhlaWdodHMucHVzaCh0aGlzLiR3YXRjaGVkW2ldLm9mZnNldEhlaWdodCk7XHJcbiAgICB9XHJcbiAgICBjYihoZWlnaHRzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbmRzIHRoZSBvdXRlciBoZWlnaHRzIG9mIGNoaWxkcmVuIGNvbnRhaW5lZCB3aXRoaW4gYW4gRXF1YWxpemVyIHBhcmVudCBhbmQgcmV0dXJucyB0aGVtIGluIGFuIGFycmF5XHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBBIG5vbi1vcHRpb25hbCBjYWxsYmFjayB0byByZXR1cm4gdGhlIGhlaWdodHMgYXJyYXkgdG8uXHJcbiAgICogQHJldHVybnMge0FycmF5fSBncm91cHMgLSBBbiBhcnJheSBvZiBoZWlnaHRzIG9mIGNoaWxkcmVuIHdpdGhpbiBFcXVhbGl6ZXIgY29udGFpbmVyIGdyb3VwZWQgYnkgcm93IHdpdGggZWxlbWVudCxoZWlnaHQgYW5kIG1heCBhcyBsYXN0IGNoaWxkXHJcbiAgICovXHJcbiAgZ2V0SGVpZ2h0c0J5Um93KGNiKSB7XHJcbiAgICB2YXIgbGFzdEVsVG9wT2Zmc2V0ID0gKHRoaXMuJHdhdGNoZWQubGVuZ3RoID8gdGhpcy4kd2F0Y2hlZC5maXJzdCgpLm9mZnNldCgpLnRvcCA6IDApLFxyXG4gICAgICAgIGdyb3VwcyA9IFtdLFxyXG4gICAgICAgIGdyb3VwID0gMDtcclxuICAgIC8vZ3JvdXAgYnkgUm93XHJcbiAgICBncm91cHNbZ3JvdXBdID0gW107XHJcbiAgICBmb3IodmFyIGkgPSAwLCBsZW4gPSB0aGlzLiR3YXRjaGVkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKXtcclxuICAgICAgdGhpcy4kd2F0Y2hlZFtpXS5zdHlsZS5oZWlnaHQgPSAnYXV0byc7XHJcbiAgICAgIC8vbWF5YmUgY291bGQgdXNlIHRoaXMuJHdhdGNoZWRbaV0ub2Zmc2V0VG9wXHJcbiAgICAgIHZhciBlbE9mZnNldFRvcCA9ICQodGhpcy4kd2F0Y2hlZFtpXSkub2Zmc2V0KCkudG9wO1xyXG4gICAgICBpZiAoZWxPZmZzZXRUb3AhPWxhc3RFbFRvcE9mZnNldCkge1xyXG4gICAgICAgIGdyb3VwKys7XHJcbiAgICAgICAgZ3JvdXBzW2dyb3VwXSA9IFtdO1xyXG4gICAgICAgIGxhc3RFbFRvcE9mZnNldD1lbE9mZnNldFRvcDtcclxuICAgICAgfVxyXG4gICAgICBncm91cHNbZ3JvdXBdLnB1c2goW3RoaXMuJHdhdGNoZWRbaV0sdGhpcy4kd2F0Y2hlZFtpXS5vZmZzZXRIZWlnaHRdKTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBqID0gMCwgbG4gPSBncm91cHMubGVuZ3RoOyBqIDwgbG47IGorKykge1xyXG4gICAgICB2YXIgaGVpZ2h0cyA9ICQoZ3JvdXBzW2pdKS5tYXAoZnVuY3Rpb24oKXsgcmV0dXJuIHRoaXNbMV07IH0pLmdldCgpO1xyXG4gICAgICB2YXIgbWF4ICAgICAgICAgPSBNYXRoLm1heC5hcHBseShudWxsLCBoZWlnaHRzKTtcclxuICAgICAgZ3JvdXBzW2pdLnB1c2gobWF4KTtcclxuICAgIH1cclxuICAgIGNiKGdyb3Vwcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGFuZ2VzIHRoZSBDU1MgaGVpZ2h0IHByb3BlcnR5IG9mIGVhY2ggY2hpbGQgaW4gYW4gRXF1YWxpemVyIHBhcmVudCB0byBtYXRjaCB0aGUgdGFsbGVzdFxyXG4gICAqIEBwYXJhbSB7YXJyYXl9IGhlaWdodHMgLSBBbiBhcnJheSBvZiBoZWlnaHRzIG9mIGNoaWxkcmVuIHdpdGhpbiBFcXVhbGl6ZXIgY29udGFpbmVyXHJcbiAgICogQGZpcmVzIEVxdWFsaXplciNwcmVlcXVhbGl6ZWRcclxuICAgKiBAZmlyZXMgRXF1YWxpemVyI3Bvc3RlcXVhbGl6ZWRcclxuICAgKi9cclxuICBhcHBseUhlaWdodChoZWlnaHRzKSB7XHJcbiAgICB2YXIgbWF4ID0gTWF0aC5tYXguYXBwbHkobnVsbCwgaGVpZ2h0cyk7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIGJlZm9yZSB0aGUgaGVpZ2h0cyBhcmUgYXBwbGllZFxyXG4gICAgICogQGV2ZW50IEVxdWFsaXplciNwcmVlcXVhbGl6ZWRcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdwcmVlcXVhbGl6ZWQuemYuZXF1YWxpemVyJyk7XHJcblxyXG4gICAgdGhpcy4kd2F0Y2hlZC5jc3MoJ2hlaWdodCcsIG1heCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBoZWlnaHRzIGhhdmUgYmVlbiBhcHBsaWVkXHJcbiAgICAgKiBAZXZlbnQgRXF1YWxpemVyI3Bvc3RlcXVhbGl6ZWRcclxuICAgICAqL1xyXG4gICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncG9zdGVxdWFsaXplZC56Zi5lcXVhbGl6ZXInKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoYW5nZXMgdGhlIENTUyBoZWlnaHQgcHJvcGVydHkgb2YgZWFjaCBjaGlsZCBpbiBhbiBFcXVhbGl6ZXIgcGFyZW50IHRvIG1hdGNoIHRoZSB0YWxsZXN0IGJ5IHJvd1xyXG4gICAqIEBwYXJhbSB7YXJyYXl9IGdyb3VwcyAtIEFuIGFycmF5IG9mIGhlaWdodHMgb2YgY2hpbGRyZW4gd2l0aGluIEVxdWFsaXplciBjb250YWluZXIgZ3JvdXBlZCBieSByb3cgd2l0aCBlbGVtZW50LGhlaWdodCBhbmQgbWF4IGFzIGxhc3QgY2hpbGRcclxuICAgKiBAZmlyZXMgRXF1YWxpemVyI3ByZWVxdWFsaXplZFxyXG4gICAqIEBmaXJlcyBFcXVhbGl6ZXIjcHJlZXF1YWxpemVkcm93XHJcbiAgICogQGZpcmVzIEVxdWFsaXplciNwb3N0ZXF1YWxpemVkcm93XHJcbiAgICogQGZpcmVzIEVxdWFsaXplciNwb3N0ZXF1YWxpemVkXHJcbiAgICovXHJcbiAgYXBwbHlIZWlnaHRCeVJvdyhncm91cHMpIHtcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgYmVmb3JlIHRoZSBoZWlnaHRzIGFyZSBhcHBsaWVkXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncHJlZXF1YWxpemVkLnpmLmVxdWFsaXplcicpO1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGdyb3Vwcy5sZW5ndGg7IGkgPCBsZW4gOyBpKyspIHtcclxuICAgICAgdmFyIGdyb3Vwc0lMZW5ndGggPSBncm91cHNbaV0ubGVuZ3RoLFxyXG4gICAgICAgICAgbWF4ID0gZ3JvdXBzW2ldW2dyb3Vwc0lMZW5ndGggLSAxXTtcclxuICAgICAgaWYgKGdyb3Vwc0lMZW5ndGg8PTIpIHtcclxuICAgICAgICAkKGdyb3Vwc1tpXVswXVswXSkuY3NzKHsnaGVpZ2h0JzonYXV0byd9KTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICAqIEZpcmVzIGJlZm9yZSB0aGUgaGVpZ2h0cyBwZXIgcm93IGFyZSBhcHBsaWVkXHJcbiAgICAgICAgKiBAZXZlbnQgRXF1YWxpemVyI3ByZWVxdWFsaXplZHJvd1xyXG4gICAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncHJlZXF1YWxpemVkcm93LnpmLmVxdWFsaXplcicpO1xyXG4gICAgICBmb3IgKHZhciBqID0gMCwgbGVuSiA9IChncm91cHNJTGVuZ3RoLTEpOyBqIDwgbGVuSiA7IGorKykge1xyXG4gICAgICAgICQoZ3JvdXBzW2ldW2pdWzBdKS5jc3MoeydoZWlnaHQnOm1heH0pO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgICogRmlyZXMgd2hlbiB0aGUgaGVpZ2h0cyBwZXIgcm93IGhhdmUgYmVlbiBhcHBsaWVkXHJcbiAgICAgICAgKiBAZXZlbnQgRXF1YWxpemVyI3Bvc3RlcXVhbGl6ZWRyb3dcclxuICAgICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3Bvc3RlcXVhbGl6ZWRyb3cuemYuZXF1YWxpemVyJyk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIGhlaWdodHMgaGF2ZSBiZWVuIGFwcGxpZWRcclxuICAgICAqL1xyXG4gICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncG9zdGVxdWFsaXplZC56Zi5lcXVhbGl6ZXInKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIEVxdWFsaXplci5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy5fcGF1c2VFdmVudHMoKTtcclxuICAgIHRoaXMuJHdhdGNoZWQuY3NzKCdoZWlnaHQnLCAnYXV0bycpO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZWZhdWx0IHNldHRpbmdzIGZvciBwbHVnaW5cclxuICovXHJcbkVxdWFsaXplci5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBFbmFibGUgaGVpZ2h0IGVxdWFsaXphdGlvbiB3aGVuIHN0YWNrZWQgb24gc21hbGxlciBzY3JlZW5zLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgZXF1YWxpemVPblN0YWNrOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBFbmFibGUgaGVpZ2h0IGVxdWFsaXphdGlvbiByb3cgYnkgcm93LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGVxdWFsaXplQnlSb3c6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIFN0cmluZyByZXByZXNlbnRpbmcgdGhlIG1pbmltdW0gYnJlYWtwb2ludCBzaXplIHRoZSBwbHVnaW4gc2hvdWxkIGVxdWFsaXplIGhlaWdodHMgb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdtZWRpdW0nXHJcbiAgICovXHJcbiAgZXF1YWxpemVPbjogJydcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKEVxdWFsaXplciwgJ0VxdWFsaXplcicpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIEludGVyY2hhbmdlIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmludGVyY2hhbmdlXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRpbWVyQW5kSW1hZ2VMb2FkZXJcclxuICovXHJcblxyXG5jbGFzcyBJbnRlcmNoYW5nZSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBJbnRlcmNoYW5nZS5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgSW50ZXJjaGFuZ2UjaW5pdFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBhZGQgdGhlIHRyaWdnZXIgdG8uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIEludGVyY2hhbmdlLmRlZmF1bHRzLCBvcHRpb25zKTtcclxuICAgIHRoaXMucnVsZXMgPSBbXTtcclxuICAgIHRoaXMuY3VycmVudFBhdGggPSAnJztcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdJbnRlcmNoYW5nZScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIEludGVyY2hhbmdlIHBsdWdpbiBhbmQgY2FsbHMgZnVuY3Rpb25zIHRvIGdldCBpbnRlcmNoYW5nZSBmdW5jdGlvbmluZyBvbiBsb2FkLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB0aGlzLl9hZGRCcmVha3BvaW50cygpO1xyXG4gICAgdGhpcy5fZ2VuZXJhdGVSdWxlcygpO1xyXG4gICAgdGhpcy5fcmVmbG93KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyBldmVudHMgZm9yIEludGVyY2hhbmdlLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgICQod2luZG93KS5vbigncmVzaXplLnpmLmludGVyY2hhbmdlJywgRm91bmRhdGlvbi51dGlsLnRocm90dGxlKCgpID0+IHtcclxuICAgICAgdGhpcy5fcmVmbG93KCk7XHJcbiAgICB9LCA1MCkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsbHMgbmVjZXNzYXJ5IGZ1bmN0aW9ucyB0byB1cGRhdGUgSW50ZXJjaGFuZ2UgdXBvbiBET00gY2hhbmdlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcmVmbG93KCkge1xyXG4gICAgdmFyIG1hdGNoO1xyXG5cclxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBlYWNoIHJ1bGUsIGJ1dCBvbmx5IHNhdmUgdGhlIGxhc3QgbWF0Y2hcclxuICAgIGZvciAodmFyIGkgaW4gdGhpcy5ydWxlcykge1xyXG4gICAgICBpZih0aGlzLnJ1bGVzLmhhc093blByb3BlcnR5KGkpKSB7XHJcbiAgICAgICAgdmFyIHJ1bGUgPSB0aGlzLnJ1bGVzW2ldO1xyXG4gICAgICAgIGlmICh3aW5kb3cubWF0Y2hNZWRpYShydWxlLnF1ZXJ5KS5tYXRjaGVzKSB7XHJcbiAgICAgICAgICBtYXRjaCA9IHJ1bGU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgIHRoaXMucmVwbGFjZShtYXRjaC5wYXRoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldHMgdGhlIEZvdW5kYXRpb24gYnJlYWtwb2ludHMgYW5kIGFkZHMgdGhlbSB0byB0aGUgSW50ZXJjaGFuZ2UuU1BFQ0lBTF9RVUVSSUVTIG9iamVjdC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9hZGRCcmVha3BvaW50cygpIHtcclxuICAgIGZvciAodmFyIGkgaW4gRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LnF1ZXJpZXMpIHtcclxuICAgICAgaWYgKEZvdW5kYXRpb24uTWVkaWFRdWVyeS5xdWVyaWVzLmhhc093blByb3BlcnR5KGkpKSB7XHJcbiAgICAgICAgdmFyIHF1ZXJ5ID0gRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LnF1ZXJpZXNbaV07XHJcbiAgICAgICAgSW50ZXJjaGFuZ2UuU1BFQ0lBTF9RVUVSSUVTW3F1ZXJ5Lm5hbWVdID0gcXVlcnkudmFsdWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyB0aGUgSW50ZXJjaGFuZ2UgZWxlbWVudCBmb3IgdGhlIHByb3ZpZGVkIG1lZGlhIHF1ZXJ5ICsgY29udGVudCBwYWlyaW5nc1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRoYXQgaXMgYW4gSW50ZXJjaGFuZ2UgaW5zdGFuY2VcclxuICAgKiBAcmV0dXJucyB7QXJyYXl9IHNjZW5hcmlvcyAtIEFycmF5IG9mIG9iamVjdHMgdGhhdCBoYXZlICdtcScgYW5kICdwYXRoJyBrZXlzIHdpdGggY29ycmVzcG9uZGluZyBrZXlzXHJcbiAgICovXHJcbiAgX2dlbmVyYXRlUnVsZXMoZWxlbWVudCkge1xyXG4gICAgdmFyIHJ1bGVzTGlzdCA9IFtdO1xyXG4gICAgdmFyIHJ1bGVzO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMucnVsZXMpIHtcclxuICAgICAgcnVsZXMgPSB0aGlzLm9wdGlvbnMucnVsZXM7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgcnVsZXMgPSB0aGlzLiRlbGVtZW50LmRhdGEoJ2ludGVyY2hhbmdlJykubWF0Y2goL1xcWy4qP1xcXS9nKTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpIGluIHJ1bGVzKSB7XHJcbiAgICAgIGlmKHJ1bGVzLmhhc093blByb3BlcnR5KGkpKSB7XHJcbiAgICAgICAgdmFyIHJ1bGUgPSBydWxlc1tpXS5zbGljZSgxLCAtMSkuc3BsaXQoJywgJyk7XHJcbiAgICAgICAgdmFyIHBhdGggPSBydWxlLnNsaWNlKDAsIC0xKS5qb2luKCcnKTtcclxuICAgICAgICB2YXIgcXVlcnkgPSBydWxlW3J1bGUubGVuZ3RoIC0gMV07XHJcblxyXG4gICAgICAgIGlmIChJbnRlcmNoYW5nZS5TUEVDSUFMX1FVRVJJRVNbcXVlcnldKSB7XHJcbiAgICAgICAgICBxdWVyeSA9IEludGVyY2hhbmdlLlNQRUNJQUxfUVVFUklFU1txdWVyeV07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBydWxlc0xpc3QucHVzaCh7XHJcbiAgICAgICAgICBwYXRoOiBwYXRoLFxyXG4gICAgICAgICAgcXVlcnk6IHF1ZXJ5XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnJ1bGVzID0gcnVsZXNMaXN0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBgc3JjYCBwcm9wZXJ0eSBvZiBhbiBpbWFnZSwgb3IgY2hhbmdlIHRoZSBIVE1MIG9mIGEgY29udGFpbmVyLCB0byB0aGUgc3BlY2lmaWVkIHBhdGguXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggLSBQYXRoIHRvIHRoZSBpbWFnZSBvciBIVE1MIHBhcnRpYWwuXHJcbiAgICogQGZpcmVzIEludGVyY2hhbmdlI3JlcGxhY2VkXHJcbiAgICovXHJcbiAgcmVwbGFjZShwYXRoKSB7XHJcbiAgICBpZiAodGhpcy5jdXJyZW50UGF0aCA9PT0gcGF0aCkgcmV0dXJuO1xyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgdHJpZ2dlciA9ICdyZXBsYWNlZC56Zi5pbnRlcmNoYW5nZSc7XHJcblxyXG4gICAgLy8gUmVwbGFjaW5nIGltYWdlc1xyXG4gICAgaWYgKHRoaXMuJGVsZW1lbnRbMF0ubm9kZU5hbWUgPT09ICdJTUcnKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYXR0cignc3JjJywgcGF0aCkub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBfdGhpcy5jdXJyZW50UGF0aCA9IHBhdGg7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50cmlnZ2VyKHRyaWdnZXIpO1xyXG4gICAgfVxyXG4gICAgLy8gUmVwbGFjaW5nIGJhY2tncm91bmQgaW1hZ2VzXHJcbiAgICBlbHNlIGlmIChwYXRoLm1hdGNoKC9cXC4oZ2lmfGpwZ3xqcGVnfHBuZ3xzdmd8dGlmZikoWz8jXS4qKT8vaSkpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5jc3MoeyAnYmFja2dyb3VuZC1pbWFnZSc6ICd1cmwoJytwYXRoKycpJyB9KVxyXG4gICAgICAgICAgLnRyaWdnZXIodHJpZ2dlcik7XHJcbiAgICB9XHJcbiAgICAvLyBSZXBsYWNpbmcgSFRNTFxyXG4gICAgZWxzZSB7XHJcbiAgICAgICQuZ2V0KHBhdGgsIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgX3RoaXMuJGVsZW1lbnQuaHRtbChyZXNwb25zZSlcclxuICAgICAgICAgICAgIC50cmlnZ2VyKHRyaWdnZXIpO1xyXG4gICAgICAgICQocmVzcG9uc2UpLmZvdW5kYXRpb24oKTtcclxuICAgICAgICBfdGhpcy5jdXJyZW50UGF0aCA9IHBhdGg7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiBjb250ZW50IGluIGFuIEludGVyY2hhbmdlIGVsZW1lbnQgaXMgZG9uZSBiZWluZyBsb2FkZWQuXHJcbiAgICAgKiBAZXZlbnQgSW50ZXJjaGFuZ2UjcmVwbGFjZWRcclxuICAgICAqL1xyXG4gICAgLy8gdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdyZXBsYWNlZC56Zi5pbnRlcmNoYW5nZScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgaW50ZXJjaGFuZ2UuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIC8vVE9ETyB0aGlzLlxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgc2V0dGluZ3MgZm9yIHBsdWdpblxyXG4gKi9cclxuSW50ZXJjaGFuZ2UuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogUnVsZXMgdG8gYmUgYXBwbGllZCB0byBJbnRlcmNoYW5nZSBlbGVtZW50cy4gU2V0IHdpdGggdGhlIGBkYXRhLWludGVyY2hhbmdlYCBhcnJheSBub3RhdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICovXHJcbiAgcnVsZXM6IG51bGxcclxufTtcclxuXHJcbkludGVyY2hhbmdlLlNQRUNJQUxfUVVFUklFUyA9IHtcclxuICAnbGFuZHNjYXBlJzogJ3NjcmVlbiBhbmQgKG9yaWVudGF0aW9uOiBsYW5kc2NhcGUpJyxcclxuICAncG9ydHJhaXQnOiAnc2NyZWVuIGFuZCAob3JpZW50YXRpb246IHBvcnRyYWl0KScsXHJcbiAgJ3JldGluYSc6ICdvbmx5IHNjcmVlbiBhbmQgKC13ZWJraXQtbWluLWRldmljZS1waXhlbC1yYXRpbzogMiksIG9ubHkgc2NyZWVuIGFuZCAobWluLS1tb3otZGV2aWNlLXBpeGVsLXJhdGlvOiAyKSwgb25seSBzY3JlZW4gYW5kICgtby1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAyLzEpLCBvbmx5IHNjcmVlbiBhbmQgKG1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDIpLCBvbmx5IHNjcmVlbiBhbmQgKG1pbi1yZXNvbHV0aW9uOiAxOTJkcGkpLCBvbmx5IHNjcmVlbiBhbmQgKG1pbi1yZXNvbHV0aW9uOiAyZHBweCknXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihJbnRlcmNoYW5nZSwgJ0ludGVyY2hhbmdlJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogTWFnZWxsYW4gbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24ubWFnZWxsYW5cclxuICovXHJcblxyXG5jbGFzcyBNYWdlbGxhbiB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBNYWdlbGxhbi5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgTWFnZWxsYW4jaW5pdFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBhZGQgdGhlIHRyaWdnZXIgdG8uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zICA9ICQuZXh0ZW5kKHt9LCBNYWdlbGxhbi5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuICAgIHRoaXMuY2FsY1BvaW50cygpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ01hZ2VsbGFuJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgTWFnZWxsYW4gcGx1Z2luIGFuZCBjYWxscyBmdW5jdGlvbnMgdG8gZ2V0IGVxdWFsaXplciBmdW5jdGlvbmluZyBvbiBsb2FkLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgaWQgPSB0aGlzLiRlbGVtZW50WzBdLmlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ21hZ2VsbGFuJyk7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy4kdGFyZ2V0cyA9ICQoJ1tkYXRhLW1hZ2VsbGFuLXRhcmdldF0nKTtcclxuICAgIHRoaXMuJGxpbmtzID0gdGhpcy4kZWxlbWVudC5maW5kKCdhJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoe1xyXG4gICAgICAnZGF0YS1yZXNpemUnOiBpZCxcclxuICAgICAgJ2RhdGEtc2Nyb2xsJzogaWQsXHJcbiAgICAgICdpZCc6IGlkXHJcbiAgICB9KTtcclxuICAgIHRoaXMuJGFjdGl2ZSA9ICQoKTtcclxuICAgIHRoaXMuc2Nyb2xsUG9zID0gcGFyc2VJbnQod2luZG93LnBhZ2VZT2Zmc2V0LCAxMCk7XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxjdWxhdGVzIGFuIGFycmF5IG9mIHBpeGVsIHZhbHVlcyB0aGF0IGFyZSB0aGUgZGVtYXJjYXRpb24gbGluZXMgYmV0d2VlbiBsb2NhdGlvbnMgb24gdGhlIHBhZ2UuXHJcbiAgICogQ2FuIGJlIGludm9rZWQgaWYgbmV3IGVsZW1lbnRzIGFyZSBhZGRlZCBvciB0aGUgc2l6ZSBvZiBhIGxvY2F0aW9uIGNoYW5nZXMuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgY2FsY1BvaW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgYm9keSA9IGRvY3VtZW50LmJvZHksXHJcbiAgICAgICAgaHRtbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcclxuXHJcbiAgICB0aGlzLnBvaW50cyA9IFtdO1xyXG4gICAgdGhpcy53aW5IZWlnaHQgPSBNYXRoLnJvdW5kKE1hdGgubWF4KHdpbmRvdy5pbm5lckhlaWdodCwgaHRtbC5jbGllbnRIZWlnaHQpKTtcclxuICAgIHRoaXMuZG9jSGVpZ2h0ID0gTWF0aC5yb3VuZChNYXRoLm1heChib2R5LnNjcm9sbEhlaWdodCwgYm9keS5vZmZzZXRIZWlnaHQsIGh0bWwuY2xpZW50SGVpZ2h0LCBodG1sLnNjcm9sbEhlaWdodCwgaHRtbC5vZmZzZXRIZWlnaHQpKTtcclxuXHJcbiAgICB0aGlzLiR0YXJnZXRzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgdmFyICR0YXIgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgcHQgPSBNYXRoLnJvdW5kKCR0YXIub2Zmc2V0KCkudG9wIC0gX3RoaXMub3B0aW9ucy50aHJlc2hvbGQpO1xyXG4gICAgICAkdGFyLnRhcmdldFBvaW50ID0gcHQ7XHJcbiAgICAgIF90aGlzLnBvaW50cy5wdXNoKHB0KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgZXZlbnRzIGZvciBNYWdlbGxhbi5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgICRib2R5ID0gJCgnaHRtbCwgYm9keScpLFxyXG4gICAgICAgIG9wdHMgPSB7XHJcbiAgICAgICAgICBkdXJhdGlvbjogX3RoaXMub3B0aW9ucy5hbmltYXRpb25EdXJhdGlvbixcclxuICAgICAgICAgIGVhc2luZzogICBfdGhpcy5vcHRpb25zLmFuaW1hdGlvbkVhc2luZ1xyXG4gICAgICAgIH07XHJcbiAgICAkKHdpbmRvdykub25lKCdsb2FkJywgZnVuY3Rpb24oKXtcclxuICAgICAgaWYoX3RoaXMub3B0aW9ucy5kZWVwTGlua2luZyl7XHJcbiAgICAgICAgaWYobG9jYXRpb24uaGFzaCl7XHJcbiAgICAgICAgICBfdGhpcy5zY3JvbGxUb0xvYyhsb2NhdGlvbi5oYXNoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgX3RoaXMuY2FsY1BvaW50cygpO1xyXG4gICAgICBfdGhpcy5fdXBkYXRlQWN0aXZlKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uKHtcclxuICAgICAgJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInOiB0aGlzLnJlZmxvdy5iaW5kKHRoaXMpLFxyXG4gICAgICAnc2Nyb2xsbWUuemYudHJpZ2dlcic6IHRoaXMuX3VwZGF0ZUFjdGl2ZS5iaW5kKHRoaXMpXHJcbiAgICB9KS5vbignY2xpY2suemYubWFnZWxsYW4nLCAnYVtocmVmXj1cIiNcIl0nLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIHZhciBhcnJpdmFsICAgPSB0aGlzLmdldEF0dHJpYnV0ZSgnaHJlZicpO1xyXG4gICAgICAgIF90aGlzLnNjcm9sbFRvTG9jKGFycml2YWwpO1xyXG4gICAgICB9KTtcclxuICAgICQod2luZG93KS5vbigncG9wc3RhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGlmKF90aGlzLm9wdGlvbnMuZGVlcExpbmtpbmcpIHtcclxuICAgICAgICBfdGhpcy5zY3JvbGxUb0xvYyh3aW5kb3cubG9jYXRpb24uaGFzaCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRnVuY3Rpb24gdG8gc2Nyb2xsIHRvIGEgZ2l2ZW4gbG9jYXRpb24gb24gdGhlIHBhZ2UuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGxvYyAtIGEgcHJvcGVybHkgZm9ybWF0dGVkIGpRdWVyeSBpZCBzZWxlY3Rvci4gRXhhbXBsZTogJyNmb28nXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgc2Nyb2xsVG9Mb2MobG9jKSB7XHJcbiAgICAvLyBEbyBub3RoaW5nIGlmIHRhcmdldCBkb2VzIG5vdCBleGlzdCB0byBwcmV2ZW50IGVycm9yc1xyXG4gICAgaWYgKCEkKGxvYykubGVuZ3RoKSB7cmV0dXJuIGZhbHNlO31cclxuICAgIHRoaXMuX2luVHJhbnNpdGlvbiA9IHRydWU7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIHNjcm9sbFBvcyA9IE1hdGgucm91bmQoJChsb2MpLm9mZnNldCgpLnRvcCAtIHRoaXMub3B0aW9ucy50aHJlc2hvbGQgLyAyIC0gdGhpcy5vcHRpb25zLmJhck9mZnNldCk7XHJcblxyXG4gICAgJCgnaHRtbCwgYm9keScpLnN0b3AodHJ1ZSkuYW5pbWF0ZShcclxuICAgICAgeyBzY3JvbGxUb3A6IHNjcm9sbFBvcyB9LFxyXG4gICAgICB0aGlzLm9wdGlvbnMuYW5pbWF0aW9uRHVyYXRpb24sXHJcbiAgICAgIHRoaXMub3B0aW9ucy5hbmltYXRpb25FYXNpbmcsXHJcbiAgICAgIGZ1bmN0aW9uKCkge190aGlzLl9pblRyYW5zaXRpb24gPSBmYWxzZTsgX3RoaXMuX3VwZGF0ZUFjdGl2ZSgpfVxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGxzIG5lY2Vzc2FyeSBmdW5jdGlvbnMgdG8gdXBkYXRlIE1hZ2VsbGFuIHVwb24gRE9NIGNoYW5nZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHJlZmxvdygpIHtcclxuICAgIHRoaXMuY2FsY1BvaW50cygpO1xyXG4gICAgdGhpcy5fdXBkYXRlQWN0aXZlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGVzIHRoZSB2aXNpYmlsaXR5IG9mIGFuIGFjdGl2ZSBsb2NhdGlvbiBsaW5rLCBhbmQgdXBkYXRlcyB0aGUgdXJsIGhhc2ggZm9yIHRoZSBwYWdlLCBpZiBkZWVwTGlua2luZyBlbmFibGVkLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIE1hZ2VsbGFuI3VwZGF0ZVxyXG4gICAqL1xyXG4gIF91cGRhdGVBY3RpdmUoLypldnQsIGVsZW0sIHNjcm9sbFBvcyovKSB7XHJcbiAgICBpZih0aGlzLl9pblRyYW5zaXRpb24pIHtyZXR1cm47fVxyXG4gICAgdmFyIHdpblBvcyA9IC8qc2Nyb2xsUG9zIHx8Ki8gcGFyc2VJbnQod2luZG93LnBhZ2VZT2Zmc2V0LCAxMCksXHJcbiAgICAgICAgY3VySWR4O1xyXG5cclxuICAgIGlmKHdpblBvcyArIHRoaXMud2luSGVpZ2h0ID09PSB0aGlzLmRvY0hlaWdodCl7IGN1cklkeCA9IHRoaXMucG9pbnRzLmxlbmd0aCAtIDE7IH1cclxuICAgIGVsc2UgaWYod2luUG9zIDwgdGhpcy5wb2ludHNbMF0peyBjdXJJZHggPSB1bmRlZmluZWQ7IH1cclxuICAgIGVsc2V7XHJcbiAgICAgIHZhciBpc0Rvd24gPSB0aGlzLnNjcm9sbFBvcyA8IHdpblBvcyxcclxuICAgICAgICAgIF90aGlzID0gdGhpcyxcclxuICAgICAgICAgIGN1clZpc2libGUgPSB0aGlzLnBvaW50cy5maWx0ZXIoZnVuY3Rpb24ocCwgaSl7XHJcbiAgICAgICAgICAgIHJldHVybiBpc0Rvd24gPyBwIC0gX3RoaXMub3B0aW9ucy5iYXJPZmZzZXQgPD0gd2luUG9zIDogcCAtIF90aGlzLm9wdGlvbnMuYmFyT2Zmc2V0IC0gX3RoaXMub3B0aW9ucy50aHJlc2hvbGQgPD0gd2luUG9zO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIGN1cklkeCA9IGN1clZpc2libGUubGVuZ3RoID8gY3VyVmlzaWJsZS5sZW5ndGggLSAxIDogMDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRhY3RpdmUucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmFjdGl2ZUNsYXNzKTtcclxuICAgIHRoaXMuJGFjdGl2ZSA9IHRoaXMuJGxpbmtzLmZpbHRlcignW2hyZWY9XCIjJyArIHRoaXMuJHRhcmdldHMuZXEoY3VySWR4KS5kYXRhKCdtYWdlbGxhbi10YXJnZXQnKSArICdcIl0nKS5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuYWN0aXZlQ2xhc3MpO1xyXG5cclxuICAgIGlmKHRoaXMub3B0aW9ucy5kZWVwTGlua2luZyl7XHJcbiAgICAgIHZhciBoYXNoID0gXCJcIjtcclxuICAgICAgaWYoY3VySWR4ICE9IHVuZGVmaW5lZCl7XHJcbiAgICAgICAgaGFzaCA9IHRoaXMuJGFjdGl2ZVswXS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKTtcclxuICAgICAgfVxyXG4gICAgICBpZihoYXNoICE9PSB3aW5kb3cubG9jYXRpb24uaGFzaCkge1xyXG4gICAgICAgIGlmKHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZSl7XHJcbiAgICAgICAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUobnVsbCwgbnVsbCwgaGFzaCk7XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9IGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zY3JvbGxQb3MgPSB3aW5Qb3M7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gbWFnZWxsYW4gaXMgZmluaXNoZWQgdXBkYXRpbmcgdG8gdGhlIG5ldyBhY3RpdmUgZWxlbWVudC5cclxuICAgICAqIEBldmVudCBNYWdlbGxhbiN1cGRhdGVcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCd1cGRhdGUuemYubWFnZWxsYW4nLCBbdGhpcy4kYWN0aXZlXSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBNYWdlbGxhbiBhbmQgcmVzZXRzIHRoZSB1cmwgb2YgdGhlIHdpbmRvdy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi50cmlnZ2VyIC56Zi5tYWdlbGxhbicpXHJcbiAgICAgICAgLmZpbmQoYC4ke3RoaXMub3B0aW9ucy5hY3RpdmVDbGFzc31gKS5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuYWN0aXZlQ2xhc3MpO1xyXG5cclxuICAgIGlmKHRoaXMub3B0aW9ucy5kZWVwTGlua2luZyl7XHJcbiAgICAgIHZhciBoYXNoID0gdGhpcy4kYWN0aXZlWzBdLmdldEF0dHJpYnV0ZSgnaHJlZicpO1xyXG4gICAgICB3aW5kb3cubG9jYXRpb24uaGFzaC5yZXBsYWNlKGhhc2gsICcnKTtcclxuICAgIH1cclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVmYXVsdCBzZXR0aW5ncyBmb3IgcGx1Z2luXHJcbiAqL1xyXG5NYWdlbGxhbi5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBBbW91bnQgb2YgdGltZSwgaW4gbXMsIHRoZSBhbmltYXRlZCBzY3JvbGxpbmcgc2hvdWxkIHRha2UgYmV0d2VlbiBsb2NhdGlvbnMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwMFxyXG4gICAqL1xyXG4gIGFuaW1hdGlvbkR1cmF0aW9uOiA1MDAsXHJcbiAgLyoqXHJcbiAgICogQW5pbWF0aW9uIHN0eWxlIHRvIHVzZSB3aGVuIHNjcm9sbGluZyBiZXR3ZWVuIGxvY2F0aW9ucy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2Vhc2UtaW4tb3V0J1xyXG4gICAqL1xyXG4gIGFuaW1hdGlvbkVhc2luZzogJ2xpbmVhcicsXHJcbiAgLyoqXHJcbiAgICogTnVtYmVyIG9mIHBpeGVscyB0byB1c2UgYXMgYSBtYXJrZXIgZm9yIGxvY2F0aW9uIGNoYW5nZXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwXHJcbiAgICovXHJcbiAgdGhyZXNob2xkOiA1MCxcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBhY3RpdmUgbG9jYXRpb25zIGxpbmsgb24gdGhlIG1hZ2VsbGFuIGNvbnRhaW5lci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2FjdGl2ZSdcclxuICAgKi9cclxuICBhY3RpdmVDbGFzczogJ2FjdGl2ZScsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBzY3JpcHQgdG8gbWFuaXB1bGF0ZSB0aGUgdXJsIG9mIHRoZSBjdXJyZW50IHBhZ2UsIGFuZCBpZiBzdXBwb3J0ZWQsIGFsdGVyIHRoZSBoaXN0b3J5LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgZGVlcExpbmtpbmc6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIE51bWJlciBvZiBwaXhlbHMgdG8gb2Zmc2V0IHRoZSBzY3JvbGwgb2YgdGhlIHBhZ2Ugb24gaXRlbSBjbGljayBpZiB1c2luZyBhIHN0aWNreSBuYXYgYmFyLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAyNVxyXG4gICAqL1xyXG4gIGJhck9mZnNldDogMFxyXG59XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihNYWdlbGxhbiwgJ01hZ2VsbGFuJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogT2ZmQ2FudmFzIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLm9mZmNhbnZhc1xyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvblxyXG4gKi9cclxuXHJcbmNsYXNzIE9mZkNhbnZhcyB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhbiBvZmYtY2FudmFzIHdyYXBwZXIuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIE9mZkNhbnZhcyNpbml0XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGluaXRpYWxpemUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIE9mZkNhbnZhcy5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG4gICAgdGhpcy4kbGFzdFRyaWdnZXIgPSAkKCk7XHJcbiAgICB0aGlzLiR0cmlnZ2VycyA9ICQoKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdPZmZDYW52YXMnKVxyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignT2ZmQ2FudmFzJywge1xyXG4gICAgICAnRVNDQVBFJzogJ2Nsb3NlJ1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIG9mZi1jYW52YXMgd3JhcHBlciBieSBhZGRpbmcgdGhlIGV4aXQgb3ZlcmxheSAoaWYgbmVlZGVkKS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIGlkID0gdGhpcy4kZWxlbWVudC5hdHRyKCdpZCcpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3MoYGlzLXRyYW5zaXRpb24tJHt0aGlzLm9wdGlvbnMudHJhbnNpdGlvbn1gKTtcclxuXHJcbiAgICAvLyBGaW5kIHRyaWdnZXJzIHRoYXQgYWZmZWN0IHRoaXMgZWxlbWVudCBhbmQgYWRkIGFyaWEtZXhwYW5kZWQgdG8gdGhlbVxyXG4gICAgdGhpcy4kdHJpZ2dlcnMgPSAkKGRvY3VtZW50KVxyXG4gICAgICAuZmluZCgnW2RhdGEtb3Blbj1cIicraWQrJ1wiXSwgW2RhdGEtY2xvc2U9XCInK2lkKydcIl0sIFtkYXRhLXRvZ2dsZT1cIicraWQrJ1wiXScpXHJcbiAgICAgIC5hdHRyKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJylcclxuICAgICAgLmF0dHIoJ2FyaWEtY29udHJvbHMnLCBpZCk7XHJcblxyXG4gICAgLy8gQWRkIGFuIG92ZXJsYXkgb3ZlciB0aGUgY29udGVudCBpZiBuZWNlc3NhcnlcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY29udGVudE92ZXJsYXkgPT09IHRydWUpIHtcclxuICAgICAgdmFyIG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgdmFyIG92ZXJsYXlQb3NpdGlvbiA9ICQodGhpcy4kZWxlbWVudCkuY3NzKFwicG9zaXRpb25cIikgPT09ICdmaXhlZCcgPyAnaXMtb3ZlcmxheS1maXhlZCcgOiAnaXMtb3ZlcmxheS1hYnNvbHV0ZSc7XHJcbiAgICAgIG92ZXJsYXkuc2V0QXR0cmlidXRlKCdjbGFzcycsICdqcy1vZmYtY2FudmFzLW92ZXJsYXkgJyArIG92ZXJsYXlQb3NpdGlvbik7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkgPSAkKG92ZXJsYXkpO1xyXG4gICAgICBpZihvdmVybGF5UG9zaXRpb24gPT09ICdpcy1vdmVybGF5LWZpeGVkJykge1xyXG4gICAgICAgICQoJ2JvZHknKS5hcHBlbmQodGhpcy4kb3ZlcmxheSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy4kZWxlbWVudC5zaWJsaW5ncygnW2RhdGEtb2ZmLWNhbnZhcy1jb250ZW50XScpLmFwcGVuZCh0aGlzLiRvdmVybGF5KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMub3B0aW9ucy5pc1JldmVhbGVkID0gdGhpcy5vcHRpb25zLmlzUmV2ZWFsZWQgfHwgbmV3IFJlZ0V4cCh0aGlzLm9wdGlvbnMucmV2ZWFsQ2xhc3MsICdnJykudGVzdCh0aGlzLiRlbGVtZW50WzBdLmNsYXNzTmFtZSk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pc1JldmVhbGVkID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5yZXZlYWxPbiA9IHRoaXMub3B0aW9ucy5yZXZlYWxPbiB8fCB0aGlzLiRlbGVtZW50WzBdLmNsYXNzTmFtZS5tYXRjaCgvKHJldmVhbC1mb3ItbWVkaXVtfHJldmVhbC1mb3ItbGFyZ2UpL2cpWzBdLnNwbGl0KCctJylbMl07XHJcbiAgICAgIHRoaXMuX3NldE1RQ2hlY2tlcigpO1xyXG4gICAgfVxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWUgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1lID0gcGFyc2VGbG9hdCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSgkKCdbZGF0YS1vZmYtY2FudmFzXScpWzBdKS50cmFuc2l0aW9uRHVyYXRpb24pICogMTAwMDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgdG8gdGhlIG9mZi1jYW52YXMgd3JhcHBlciBhbmQgdGhlIGV4aXQgb3ZlcmxheS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnRyaWdnZXIgLnpmLm9mZmNhbnZhcycpLm9uKHtcclxuICAgICAgJ29wZW4uemYudHJpZ2dlcic6IHRoaXMub3Blbi5iaW5kKHRoaXMpLFxyXG4gICAgICAnY2xvc2UuemYudHJpZ2dlcic6IHRoaXMuY2xvc2UuYmluZCh0aGlzKSxcclxuICAgICAgJ3RvZ2dsZS56Zi50cmlnZ2VyJzogdGhpcy50b2dnbGUuYmluZCh0aGlzKSxcclxuICAgICAgJ2tleWRvd24uemYub2ZmY2FudmFzJzogdGhpcy5faGFuZGxlS2V5Ym9hcmQuYmluZCh0aGlzKVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgPT09IHRydWUpIHtcclxuICAgICAgdmFyICR0YXJnZXQgPSB0aGlzLm9wdGlvbnMuY29udGVudE92ZXJsYXkgPyB0aGlzLiRvdmVybGF5IDogJCgnW2RhdGEtb2ZmLWNhbnZhcy1jb250ZW50XScpO1xyXG4gICAgICAkdGFyZ2V0Lm9uKHsnY2xpY2suemYub2ZmY2FudmFzJzogdGhpcy5jbG9zZS5iaW5kKHRoaXMpfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBcHBsaWVzIGV2ZW50IGxpc3RlbmVyIGZvciBlbGVtZW50cyB0aGF0IHdpbGwgcmV2ZWFsIGF0IGNlcnRhaW4gYnJlYWtwb2ludHMuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc2V0TVFDaGVja2VyKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICAkKHdpbmRvdykub24oJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAoRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmF0TGVhc3QoX3RoaXMub3B0aW9ucy5yZXZlYWxPbikpIHtcclxuICAgICAgICBfdGhpcy5yZXZlYWwodHJ1ZSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgX3RoaXMucmV2ZWFsKGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfSkub25lKCdsb2FkLnpmLm9mZmNhbnZhcycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAoRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmF0TGVhc3QoX3RoaXMub3B0aW9ucy5yZXZlYWxPbikpIHtcclxuICAgICAgICBfdGhpcy5yZXZlYWwodHJ1ZSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlcyB0aGUgcmV2ZWFsaW5nL2hpZGluZyB0aGUgb2ZmLWNhbnZhcyBhdCBicmVha3BvaW50cywgbm90IHRoZSBzYW1lIGFzIG9wZW4uXHJcbiAgICogQHBhcmFtIHtCb29sZWFufSBpc1JldmVhbGVkIC0gdHJ1ZSBpZiBlbGVtZW50IHNob3VsZCBiZSByZXZlYWxlZC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICByZXZlYWwoaXNSZXZlYWxlZCkge1xyXG4gICAgdmFyICRjbG9zZXIgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLWNsb3NlXScpO1xyXG4gICAgaWYgKGlzUmV2ZWFsZWQpIHtcclxuICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICB0aGlzLmlzUmV2ZWFsZWQgPSB0cnVlO1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub2ZmKCdvcGVuLnpmLnRyaWdnZXIgdG9nZ2xlLnpmLnRyaWdnZXInKTtcclxuICAgICAgaWYgKCRjbG9zZXIubGVuZ3RoKSB7ICRjbG9zZXIuaGlkZSgpOyB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmlzUmV2ZWFsZWQgPSBmYWxzZTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oe1xyXG4gICAgICAgICdvcGVuLnpmLnRyaWdnZXInOiB0aGlzLm9wZW4uYmluZCh0aGlzKSxcclxuICAgICAgICAndG9nZ2xlLnpmLnRyaWdnZXInOiB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpXHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAoJGNsb3Nlci5sZW5ndGgpIHtcclxuICAgICAgICAkY2xvc2VyLnNob3coKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcHMgc2Nyb2xsaW5nIG9mIHRoZSBib2R5IHdoZW4gb2ZmY2FudmFzIGlzIG9wZW4gb24gbW9iaWxlIFNhZmFyaSBhbmQgb3RoZXIgdHJvdWJsZXNvbWUgYnJvd3NlcnMuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc3RvcFNjcm9sbGluZyhldmVudCkge1xyXG4gIFx0cmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgdGhlIG9mZi1jYW52YXMgbWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgLSBFdmVudCBvYmplY3QgcGFzc2VkIGZyb20gbGlzdGVuZXIuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IHRyaWdnZXIgLSBlbGVtZW50IHRoYXQgdHJpZ2dlcmVkIHRoZSBvZmYtY2FudmFzIHRvIG9wZW4uXHJcbiAgICogQGZpcmVzIE9mZkNhbnZhcyNvcGVuZWRcclxuICAgKi9cclxuICBvcGVuKGV2ZW50LCB0cmlnZ2VyKSB7XHJcbiAgICBpZiAodGhpcy4kZWxlbWVudC5oYXNDbGFzcygnaXMtb3BlbicpIHx8IHRoaXMuaXNSZXZlYWxlZCkgeyByZXR1cm47IH1cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgaWYgKHRyaWdnZXIpIHtcclxuICAgICAgdGhpcy4kbGFzdFRyaWdnZXIgPSB0cmlnZ2VyO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZm9yY2VUbyA9PT0gJ3RvcCcpIHtcclxuICAgICAgd2luZG93LnNjcm9sbFRvKDAsIDApO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuZm9yY2VUbyA9PT0gJ2JvdHRvbScpIHtcclxuICAgICAgd2luZG93LnNjcm9sbFRvKDAsZG9jdW1lbnQuYm9keS5zY3JvbGxIZWlnaHQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgb2ZmLWNhbnZhcyBtZW51IG9wZW5zLlxyXG4gICAgICogQGV2ZW50IE9mZkNhbnZhcyNvcGVuZWRcclxuICAgICAqL1xyXG4gICAgX3RoaXMuJGVsZW1lbnQuYWRkQ2xhc3MoJ2lzLW9wZW4nKVxyXG5cclxuICAgIHRoaXMuJHRyaWdnZXJzLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWhpZGRlbicsICdmYWxzZScpXHJcbiAgICAgICAgLnRyaWdnZXIoJ29wZW5lZC56Zi5vZmZjYW52YXMnKTtcclxuXHJcbiAgICAvLyBJZiBgY29udGVudFNjcm9sbGAgaXMgc2V0IHRvIGZhbHNlLCBhZGQgY2xhc3MgYW5kIGRpc2FibGUgc2Nyb2xsaW5nIG9uIHRvdWNoIGRldmljZXMuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbnRlbnRTY3JvbGwgPT09IGZhbHNlKSB7XHJcbiAgICAgICQoJ2JvZHknKS5hZGRDbGFzcygnaXMtb2ZmLWNhbnZhcy1vcGVuJykub24oJ3RvdWNobW92ZScsIHRoaXMuX3N0b3BTY3JvbGxpbmcpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY29udGVudE92ZXJsYXkgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheS5hZGRDbGFzcygnaXMtdmlzaWJsZScpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrID09PSB0cnVlICYmIHRoaXMub3B0aW9ucy5jb250ZW50T3ZlcmxheSA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5LmFkZENsYXNzKCdpcy1jbG9zYWJsZScpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b0ZvY3VzID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZCh0aGlzLiRlbGVtZW50KSwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMuJGVsZW1lbnQuZmluZCgnYSwgYnV0dG9uJykuZXEoMCkuZm9jdXMoKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy50cmFwRm9jdXMgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5zaWJsaW5ncygnW2RhdGEtb2ZmLWNhbnZhcy1jb250ZW50XScpLmF0dHIoJ3RhYmluZGV4JywgJy0xJyk7XHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQudHJhcEZvY3VzKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvc2VzIHRoZSBvZmYtY2FudmFzIG1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBvcHRpb25hbCBjYiB0byBmaXJlIGFmdGVyIGNsb3N1cmUuXHJcbiAgICogQGZpcmVzIE9mZkNhbnZhcyNjbG9zZWRcclxuICAgKi9cclxuICBjbG9zZShjYikge1xyXG4gICAgaWYgKCF0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1vcGVuJykgfHwgdGhpcy5pc1JldmVhbGVkKSB7IHJldHVybjsgfVxyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgX3RoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2lzLW9wZW4nKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKVxyXG4gICAgICAvKipcclxuICAgICAgICogRmlyZXMgd2hlbiB0aGUgb2ZmLWNhbnZhcyBtZW51IG9wZW5zLlxyXG4gICAgICAgKiBAZXZlbnQgT2ZmQ2FudmFzI2Nsb3NlZFxyXG4gICAgICAgKi9cclxuICAgICAgICAudHJpZ2dlcignY2xvc2VkLnpmLm9mZmNhbnZhcycpO1xyXG5cclxuICAgIC8vIElmIGBjb250ZW50U2Nyb2xsYCBpcyBzZXQgdG8gZmFsc2UsIHJlbW92ZSBjbGFzcyBhbmQgcmUtZW5hYmxlIHNjcm9sbGluZyBvbiB0b3VjaCBkZXZpY2VzLlxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jb250ZW50U2Nyb2xsID09PSBmYWxzZSkge1xyXG4gICAgICAkKCdib2R5JykucmVtb3ZlQ2xhc3MoJ2lzLW9mZi1jYW52YXMtb3BlbicpLm9mZigndG91Y2htb3ZlJywgdGhpcy5fc3RvcFNjcm9sbGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jb250ZW50T3ZlcmxheSA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5LnJlbW92ZUNsYXNzKCdpcy12aXNpYmxlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgPT09IHRydWUgJiYgdGhpcy5vcHRpb25zLmNvbnRlbnRPdmVybGF5ID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkucmVtb3ZlQ2xhc3MoJ2lzLWNsb3NhYmxlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kdHJpZ2dlcnMuYXR0cignYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudHJhcEZvY3VzID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuc2libGluZ3MoJ1tkYXRhLW9mZi1jYW52YXMtY29udGVudF0nKS5yZW1vdmVBdHRyKCd0YWJpbmRleCcpO1xyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlbGVhc2VGb2N1cyh0aGlzLiRlbGVtZW50KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZXMgdGhlIG9mZi1jYW52YXMgbWVudSBvcGVuIG9yIGNsb3NlZC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgLSBFdmVudCBvYmplY3QgcGFzc2VkIGZyb20gbGlzdGVuZXIuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IHRyaWdnZXIgLSBlbGVtZW50IHRoYXQgdHJpZ2dlcmVkIHRoZSBvZmYtY2FudmFzIHRvIG9wZW4uXHJcbiAgICovXHJcbiAgdG9nZ2xlKGV2ZW50LCB0cmlnZ2VyKSB7XHJcbiAgICBpZiAodGhpcy4kZWxlbWVudC5oYXNDbGFzcygnaXMtb3BlbicpKSB7XHJcbiAgICAgIHRoaXMuY2xvc2UoZXZlbnQsIHRyaWdnZXIpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHRoaXMub3BlbihldmVudCwgdHJpZ2dlcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGVzIGtleWJvYXJkIGlucHV0IHdoZW4gZGV0ZWN0ZWQuIFdoZW4gdGhlIGVzY2FwZSBrZXkgaXMgcHJlc3NlZCwgdGhlIG9mZi1jYW52YXMgbWVudSBjbG9zZXMsIGFuZCBmb2N1cyBpcyByZXN0b3JlZCB0byB0aGUgZWxlbWVudCB0aGF0IG9wZW5lZCB0aGUgbWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9oYW5kbGVLZXlib2FyZChlKSB7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnT2ZmQ2FudmFzJywge1xyXG4gICAgICBjbG9zZTogKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgICAgICB0aGlzLiRsYXN0VHJpZ2dlci5mb2N1cygpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9LFxyXG4gICAgICBoYW5kbGVkOiAoKSA9PiB7XHJcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIG9mZmNhbnZhcyBwbHVnaW4uXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuY2xvc2UoKTtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYudHJpZ2dlciAuemYub2ZmY2FudmFzJyk7XHJcbiAgICB0aGlzLiRvdmVybGF5Lm9mZignLnpmLm9mZmNhbnZhcycpO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbk9mZkNhbnZhcy5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgdXNlciB0byBjbGljayBvdXRzaWRlIG9mIHRoZSBtZW51IHRvIGNsb3NlIGl0LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xvc2VPbkNsaWNrOiB0cnVlLFxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGFuIG92ZXJsYXkgb24gdG9wIG9mIGBbZGF0YS1vZmYtY2FudmFzLWNvbnRlbnRdYC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNvbnRlbnRPdmVybGF5OiB0cnVlLFxyXG5cclxuICAvKipcclxuICAgKiBFbmFibGUvZGlzYWJsZSBzY3JvbGxpbmcgb2YgdGhlIG1haW4gY29udGVudCB3aGVuIGFuIG9mZiBjYW52YXMgcGFuZWwgaXMgb3Blbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNvbnRlbnRTY3JvbGw6IHRydWUsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFtb3VudCBvZiB0aW1lIGluIG1zIHRoZSBvcGVuIGFuZCBjbG9zZSB0cmFuc2l0aW9uIHJlcXVpcmVzLiBJZiBub25lIHNlbGVjdGVkLCBwdWxscyBmcm9tIGJvZHkgc3R5bGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwMFxyXG4gICAqL1xyXG4gIHRyYW5zaXRpb25UaW1lOiAwLFxyXG5cclxuICAvKipcclxuICAgKiBUeXBlIG9mIHRyYW5zaXRpb24gZm9yIHRoZSBvZmZjYW52YXMgbWVudS4gT3B0aW9ucyBhcmUgJ3B1c2gnLCAnZGV0YWNoZWQnIG9yICdzbGlkZScuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHB1c2hcclxuICAgKi9cclxuICB0cmFuc2l0aW9uOiAncHVzaCcsXHJcblxyXG4gIC8qKlxyXG4gICAqIEZvcmNlIHRoZSBwYWdlIHRvIHNjcm9sbCB0byB0b3Agb3IgYm90dG9tIG9uIG9wZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRvcFxyXG4gICAqL1xyXG4gIGZvcmNlVG86IG51bGwsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBvZmZjYW52YXMgdG8gcmVtYWluIG9wZW4gZm9yIGNlcnRhaW4gYnJlYWtwb2ludHMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgaXNSZXZlYWxlZDogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIEJyZWFrcG9pbnQgYXQgd2hpY2ggdG8gcmV2ZWFsLiBKUyB3aWxsIHVzZSBhIFJlZ0V4cCB0byB0YXJnZXQgc3RhbmRhcmQgY2xhc3NlcywgaWYgY2hhbmdpbmcgY2xhc3NuYW1lcywgcGFzcyB5b3VyIGNsYXNzIHdpdGggdGhlIGByZXZlYWxDbGFzc2Agb3B0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSByZXZlYWwtZm9yLWxhcmdlXHJcbiAgICovXHJcbiAgcmV2ZWFsT246IG51bGwsXHJcblxyXG4gIC8qKlxyXG4gICAqIEZvcmNlIGZvY3VzIHRvIHRoZSBvZmZjYW52YXMgb24gb3Blbi4gSWYgdHJ1ZSwgd2lsbCBmb2N1cyB0aGUgb3BlbmluZyB0cmlnZ2VyIG9uIGNsb3NlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgYXV0b0ZvY3VzOiB0cnVlLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyB1c2VkIHRvIGZvcmNlIGFuIG9mZmNhbnZhcyB0byByZW1haW4gb3Blbi4gRm91bmRhdGlvbiBkZWZhdWx0cyBmb3IgdGhpcyBhcmUgYHJldmVhbC1mb3ItbGFyZ2VgICYgYHJldmVhbC1mb3ItbWVkaXVtYC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogVE9ETyBpbXByb3ZlIHRoZSByZWdleCB0ZXN0aW5nIGZvciB0aGlzLlxyXG4gICAqIEBleGFtcGxlIHJldmVhbC1mb3ItbGFyZ2VcclxuICAgKi9cclxuICByZXZlYWxDbGFzczogJ3JldmVhbC1mb3ItJyxcclxuXHJcbiAgLyoqXHJcbiAgICogVHJpZ2dlcnMgb3B0aW9uYWwgZm9jdXMgdHJhcHBpbmcgd2hlbiBvcGVuaW5nIGFuIG9mZmNhbnZhcy4gU2V0cyB0YWJpbmRleCBvZiBbZGF0YS1vZmYtY2FudmFzLWNvbnRlbnRdIHRvIC0xIGZvciBhY2Nlc3NpYmlsaXR5IHB1cnBvc2VzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgdHJhcEZvY3VzOiBmYWxzZVxyXG59XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihPZmZDYW52YXMsICdPZmZDYW52YXMnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBPcmJpdCBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5vcmJpdFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudGltZXJBbmRJbWFnZUxvYWRlclxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRvdWNoXHJcbiAqL1xyXG5cclxuY2xhc3MgT3JiaXQge1xyXG4gIC8qKlxyXG4gICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhbiBvcmJpdCBjYXJvdXNlbC5cclxuICAqIEBjbGFzc1xyXG4gICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhbiBPcmJpdCBDYXJvdXNlbC5cclxuICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpe1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgT3JiaXQuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnT3JiaXQnKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ09yYml0Jywge1xyXG4gICAgICAnbHRyJzoge1xyXG4gICAgICAgICdBUlJPV19SSUdIVCc6ICduZXh0JyxcclxuICAgICAgICAnQVJST1dfTEVGVCc6ICdwcmV2aW91cydcclxuICAgICAgfSxcclxuICAgICAgJ3J0bCc6IHtcclxuICAgICAgICAnQVJST1dfTEVGVCc6ICduZXh0JyxcclxuICAgICAgICAnQVJST1dfUklHSFQnOiAncHJldmlvdXMnXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBJbml0aWFsaXplcyB0aGUgcGx1Z2luIGJ5IGNyZWF0aW5nIGpRdWVyeSBjb2xsZWN0aW9ucywgc2V0dGluZyBhdHRyaWJ1dGVzLCBhbmQgc3RhcnRpbmcgdGhlIGFuaW1hdGlvbi5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgLy8gQFRPRE86IGNvbnNpZGVyIGRpc2N1c3Npb24gb24gUFIgIzkyNzggYWJvdXQgRE9NIHBvbGx1dGlvbiBieSBjaGFuZ2VTbGlkZVxyXG4gICAgdGhpcy5fcmVzZXQoKTtcclxuXHJcbiAgICB0aGlzLiR3cmFwcGVyID0gdGhpcy4kZWxlbWVudC5maW5kKGAuJHt0aGlzLm9wdGlvbnMuY29udGFpbmVyQ2xhc3N9YCk7XHJcbiAgICB0aGlzLiRzbGlkZXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoYC4ke3RoaXMub3B0aW9ucy5zbGlkZUNsYXNzfWApO1xyXG5cclxuICAgIHZhciAkaW1hZ2VzID0gdGhpcy4kZWxlbWVudC5maW5kKCdpbWcnKSxcclxuICAgICAgICBpbml0QWN0aXZlID0gdGhpcy4kc2xpZGVzLmZpbHRlcignLmlzLWFjdGl2ZScpLFxyXG4gICAgICAgIGlkID0gdGhpcy4kZWxlbWVudFswXS5pZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdvcmJpdCcpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cih7XHJcbiAgICAgICdkYXRhLXJlc2l6ZSc6IGlkLFxyXG4gICAgICAnaWQnOiBpZFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFpbml0QWN0aXZlLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLiRzbGlkZXMuZXEoMCkuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLnVzZU1VSSkge1xyXG4gICAgICB0aGlzLiRzbGlkZXMuYWRkQ2xhc3MoJ25vLW1vdGlvbnVpJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCRpbWFnZXMubGVuZ3RoKSB7XHJcbiAgICAgIEZvdW5kYXRpb24ub25JbWFnZXNMb2FkZWQoJGltYWdlcywgdGhpcy5fcHJlcGFyZUZvck9yYml0LmJpbmQodGhpcykpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5fcHJlcGFyZUZvck9yYml0KCk7Ly9oZWhlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5idWxsZXRzKSB7XHJcbiAgICAgIHRoaXMuX2xvYWRCdWxsZXRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hdXRvUGxheSAmJiB0aGlzLiRzbGlkZXMubGVuZ3RoID4gMSkge1xyXG4gICAgICB0aGlzLmdlb1N5bmMoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmFjY2Vzc2libGUpIHsgLy8gYWxsb3cgd3JhcHBlciB0byBiZSBmb2N1c2FibGUgdG8gZW5hYmxlIGFycm93IG5hdmlnYXRpb25cclxuICAgICAgdGhpcy4kd3JhcHBlci5hdHRyKCd0YWJpbmRleCcsIDApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBDcmVhdGVzIGEgalF1ZXJ5IGNvbGxlY3Rpb24gb2YgYnVsbGV0cywgaWYgdGhleSBhcmUgYmVpbmcgdXNlZC5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqL1xyXG4gIF9sb2FkQnVsbGV0cygpIHtcclxuICAgIHRoaXMuJGJ1bGxldHMgPSB0aGlzLiRlbGVtZW50LmZpbmQoYC4ke3RoaXMub3B0aW9ucy5ib3hPZkJ1bGxldHN9YCkuZmluZCgnYnV0dG9uJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIFNldHMgYSBgdGltZXJgIG9iamVjdCBvbiB0aGUgb3JiaXQsIGFuZCBzdGFydHMgdGhlIGNvdW50ZXIgZm9yIHRoZSBuZXh0IHNsaWRlLlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKi9cclxuICBnZW9TeW5jKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMudGltZXIgPSBuZXcgRm91bmRhdGlvbi5UaW1lcihcclxuICAgICAgdGhpcy4kZWxlbWVudCxcclxuICAgICAge1xyXG4gICAgICAgIGR1cmF0aW9uOiB0aGlzLm9wdGlvbnMudGltZXJEZWxheSxcclxuICAgICAgICBpbmZpbml0ZTogZmFsc2VcclxuICAgICAgfSxcclxuICAgICAgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMuY2hhbmdlU2xpZGUodHJ1ZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgdGhpcy50aW1lci5zdGFydCgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBTZXRzIHdyYXBwZXIgYW5kIHNsaWRlIGhlaWdodHMgZm9yIHRoZSBvcmJpdC5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqL1xyXG4gIF9wcmVwYXJlRm9yT3JiaXQoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy5fc2V0V3JhcHBlckhlaWdodCgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBDYWx1bGF0ZXMgdGhlIGhlaWdodCBvZiBlYWNoIHNsaWRlIGluIHRoZSBjb2xsZWN0aW9uLCBhbmQgdXNlcyB0aGUgdGFsbGVzdCBvbmUgZm9yIHRoZSB3cmFwcGVyIGhlaWdodC5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gYSBjYWxsYmFjayBmdW5jdGlvbiB0byBmaXJlIHdoZW4gY29tcGxldGUuXHJcbiAgKi9cclxuICBfc2V0V3JhcHBlckhlaWdodChjYikgey8vcmV3cml0ZSB0aGlzIHRvIGBmb3JgIGxvb3BcclxuICAgIHZhciBtYXggPSAwLCB0ZW1wLCBjb3VudGVyID0gMCwgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJHNsaWRlcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICB0ZW1wID0gdGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XHJcbiAgICAgICQodGhpcykuYXR0cignZGF0YS1zbGlkZScsIGNvdW50ZXIpO1xyXG5cclxuICAgICAgaWYgKF90aGlzLiRzbGlkZXMuZmlsdGVyKCcuaXMtYWN0aXZlJylbMF0gIT09IF90aGlzLiRzbGlkZXMuZXEoY291bnRlcilbMF0pIHsvL2lmIG5vdCB0aGUgYWN0aXZlIHNsaWRlLCBzZXQgY3NzIHBvc2l0aW9uIGFuZCBkaXNwbGF5IHByb3BlcnR5XHJcbiAgICAgICAgJCh0aGlzKS5jc3Moeydwb3NpdGlvbic6ICdyZWxhdGl2ZScsICdkaXNwbGF5JzogJ25vbmUnfSk7XHJcbiAgICAgIH1cclxuICAgICAgbWF4ID0gdGVtcCA+IG1heCA/IHRlbXAgOiBtYXg7XHJcbiAgICAgIGNvdW50ZXIrKztcclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChjb3VudGVyID09PSB0aGlzLiRzbGlkZXMubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXMuJHdyYXBwZXIuY3NzKHsnaGVpZ2h0JzogbWF4fSk7IC8vb25seSBjaGFuZ2UgdGhlIHdyYXBwZXIgaGVpZ2h0IHByb3BlcnR5IG9uY2UuXHJcbiAgICAgIGlmKGNiKSB7Y2IobWF4KTt9IC8vZmlyZSBjYWxsYmFjayB3aXRoIG1heCBoZWlnaHQgZGltZW5zaW9uLlxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBTZXRzIHRoZSBtYXgtaGVpZ2h0IG9mIGVhY2ggc2xpZGUuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKi9cclxuICBfc2V0U2xpZGVIZWlnaHQoaGVpZ2h0KSB7XHJcbiAgICB0aGlzLiRzbGlkZXMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgJCh0aGlzKS5jc3MoJ21heC1oZWlnaHQnLCBoZWlnaHQpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIHRvIGJhc2ljYWxseSBldmVyeXRoaW5nIHdpdGhpbiB0aGUgZWxlbWVudC5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAvLyoqTm93IHVzaW5nIGN1c3RvbSBldmVudCAtIHRoYW5rcyB0bzoqKlxyXG4gICAgLy8qKiAgICAgIFlvaGFpIEFyYXJhdCBvZiBUb3JvbnRvICAgICAgKipcclxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAvL1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy5yZXNpemVtZS56Zi50cmlnZ2VyJykub24oe1xyXG4gICAgICAncmVzaXplbWUuemYudHJpZ2dlcic6IHRoaXMuX3ByZXBhcmVGb3JPcmJpdC5iaW5kKHRoaXMpXHJcbiAgICB9KVxyXG4gICAgaWYgKHRoaXMuJHNsaWRlcy5sZW5ndGggPiAxKSB7XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnN3aXBlKSB7XHJcbiAgICAgICAgdGhpcy4kc2xpZGVzLm9mZignc3dpcGVsZWZ0LnpmLm9yYml0IHN3aXBlcmlnaHQuemYub3JiaXQnKVxyXG4gICAgICAgIC5vbignc3dpcGVsZWZ0LnpmLm9yYml0JywgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBfdGhpcy5jaGFuZ2VTbGlkZSh0cnVlKTtcclxuICAgICAgICB9KS5vbignc3dpcGVyaWdodC56Zi5vcmJpdCcsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgX3RoaXMuY2hhbmdlU2xpZGUoZmFsc2UpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmF1dG9QbGF5KSB7XHJcbiAgICAgICAgdGhpcy4kc2xpZGVzLm9uKCdjbGljay56Zi5vcmJpdCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgX3RoaXMuJGVsZW1lbnQuZGF0YSgnY2xpY2tlZE9uJywgX3RoaXMuJGVsZW1lbnQuZGF0YSgnY2xpY2tlZE9uJykgPyBmYWxzZSA6IHRydWUpO1xyXG4gICAgICAgICAgX3RoaXMudGltZXJbX3RoaXMuJGVsZW1lbnQuZGF0YSgnY2xpY2tlZE9uJykgPyAncGF1c2UnIDogJ3N0YXJ0J10oKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5wYXVzZU9uSG92ZXIpIHtcclxuICAgICAgICAgIHRoaXMuJGVsZW1lbnQub24oJ21vdXNlZW50ZXIuemYub3JiaXQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgX3RoaXMudGltZXIucGF1c2UoKTtcclxuICAgICAgICAgIH0pLm9uKCdtb3VzZWxlYXZlLnpmLm9yYml0JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmICghX3RoaXMuJGVsZW1lbnQuZGF0YSgnY2xpY2tlZE9uJykpIHtcclxuICAgICAgICAgICAgICBfdGhpcy50aW1lci5zdGFydCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMubmF2QnV0dG9ucykge1xyXG4gICAgICAgIHZhciAkY29udHJvbHMgPSB0aGlzLiRlbGVtZW50LmZpbmQoYC4ke3RoaXMub3B0aW9ucy5uZXh0Q2xhc3N9LCAuJHt0aGlzLm9wdGlvbnMucHJldkNsYXNzfWApO1xyXG4gICAgICAgICRjb250cm9scy5hdHRyKCd0YWJpbmRleCcsIDApXHJcbiAgICAgICAgLy9hbHNvIG5lZWQgdG8gaGFuZGxlIGVudGVyL3JldHVybiBhbmQgc3BhY2ViYXIga2V5IHByZXNzZXNcclxuICAgICAgICAub24oJ2NsaWNrLnpmLm9yYml0IHRvdWNoZW5kLnpmLm9yYml0JywgZnVuY3Rpb24oZSl7XHJcblx0ICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBfdGhpcy5jaGFuZ2VTbGlkZSgkKHRoaXMpLmhhc0NsYXNzKF90aGlzLm9wdGlvbnMubmV4dENsYXNzKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuYnVsbGV0cykge1xyXG4gICAgICAgIHRoaXMuJGJ1bGxldHMub24oJ2NsaWNrLnpmLm9yYml0IHRvdWNoZW5kLnpmLm9yYml0JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoL2lzLWFjdGl2ZS9nLnRlc3QodGhpcy5jbGFzc05hbWUpKSB7IHJldHVybiBmYWxzZTsgfS8vaWYgdGhpcyBpcyBhY3RpdmUsIGtpY2sgb3V0IG9mIGZ1bmN0aW9uLlxyXG4gICAgICAgICAgdmFyIGlkeCA9ICQodGhpcykuZGF0YSgnc2xpZGUnKSxcclxuICAgICAgICAgIGx0ciA9IGlkeCA+IF90aGlzLiRzbGlkZXMuZmlsdGVyKCcuaXMtYWN0aXZlJykuZGF0YSgnc2xpZGUnKSxcclxuICAgICAgICAgICRzbGlkZSA9IF90aGlzLiRzbGlkZXMuZXEoaWR4KTtcclxuXHJcbiAgICAgICAgICBfdGhpcy5jaGFuZ2VTbGlkZShsdHIsICRzbGlkZSwgaWR4KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5hY2Nlc3NpYmxlKSB7XHJcbiAgICAgICAgdGhpcy4kd3JhcHBlci5hZGQodGhpcy4kYnVsbGV0cykub24oJ2tleWRvd24uemYub3JiaXQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAvLyBoYW5kbGUga2V5Ym9hcmQgZXZlbnQgd2l0aCBrZXlib2FyZCB1dGlsXHJcbiAgICAgICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnT3JiaXQnLCB7XHJcbiAgICAgICAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgIF90aGlzLmNoYW5nZVNsaWRlKHRydWUpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwcmV2aW91czogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgX3RoaXMuY2hhbmdlU2xpZGUoZmFsc2UpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbigpIHsgLy8gaWYgYnVsbGV0IGlzIGZvY3VzZWQsIG1ha2Ugc3VyZSBmb2N1cyBtb3Zlc1xyXG4gICAgICAgICAgICAgIGlmICgkKGUudGFyZ2V0KS5pcyhfdGhpcy4kYnVsbGV0cykpIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLiRidWxsZXRzLmZpbHRlcignLmlzLWFjdGl2ZScpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXRzIE9yYml0IHNvIGl0IGNhbiBiZSByZWluaXRpYWxpemVkXHJcbiAgICovXHJcbiAgX3Jlc2V0KCkge1xyXG4gICAgLy8gRG9uJ3QgZG8gYW55dGhpbmcgaWYgdGhlcmUgYXJlIG5vIHNsaWRlcyAoZmlyc3QgcnVuKVxyXG4gICAgaWYgKHR5cGVvZiB0aGlzLiRzbGlkZXMgPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLiRzbGlkZXMubGVuZ3RoID4gMSkge1xyXG4gICAgICAvLyBSZW1vdmUgb2xkIGV2ZW50c1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLm9yYml0JykuZmluZCgnKicpLm9mZignLnpmLm9yYml0JylcclxuXHJcbiAgICAgIC8vIFJlc3RhcnQgdGltZXIgaWYgYXV0b1BsYXkgaXMgZW5hYmxlZFxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmF1dG9QbGF5KSB7XHJcbiAgICAgICAgdGhpcy50aW1lci5yZXN0YXJ0KCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFJlc2V0IGFsbCBzbGlkZGVzXHJcbiAgICAgIHRoaXMuJHNsaWRlcy5lYWNoKGZ1bmN0aW9uKGVsKSB7XHJcbiAgICAgICAgJChlbCkucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZSBpcy1hY3RpdmUgaXMtaW4nKVxyXG4gICAgICAgICAgLnJlbW92ZUF0dHIoJ2FyaWEtbGl2ZScpXHJcbiAgICAgICAgICAuaGlkZSgpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIFNob3cgdGhlIGZpcnN0IHNsaWRlXHJcbiAgICAgIHRoaXMuJHNsaWRlcy5maXJzdCgpLmFkZENsYXNzKCdpcy1hY3RpdmUnKS5zaG93KCk7XHJcblxyXG4gICAgICAvLyBUcmlnZ2VycyB3aGVuIHRoZSBzbGlkZSBoYXMgZmluaXNoZWQgYW5pbWF0aW5nXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignc2xpZGVjaGFuZ2UuemYub3JiaXQnLCBbdGhpcy4kc2xpZGVzLmZpcnN0KCldKTtcclxuXHJcbiAgICAgIC8vIFNlbGVjdCBmaXJzdCBidWxsZXQgaWYgYnVsbGV0cyBhcmUgcHJlc2VudFxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmJ1bGxldHMpIHtcclxuICAgICAgICB0aGlzLl91cGRhdGVCdWxsZXRzKDApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIENoYW5nZXMgdGhlIGN1cnJlbnQgc2xpZGUgdG8gYSBuZXcgb25lLlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcGFyYW0ge0Jvb2xlYW59IGlzTFRSIC0gZmxhZyBpZiB0aGUgc2xpZGUgc2hvdWxkIG1vdmUgbGVmdCB0byByaWdodC5cclxuICAqIEBwYXJhbSB7alF1ZXJ5fSBjaG9zZW5TbGlkZSAtIHRoZSBqUXVlcnkgZWxlbWVudCBvZiB0aGUgc2xpZGUgdG8gc2hvdyBuZXh0LCBpZiBvbmUgaXMgc2VsZWN0ZWQuXHJcbiAgKiBAcGFyYW0ge051bWJlcn0gaWR4IC0gdGhlIGluZGV4IG9mIHRoZSBuZXcgc2xpZGUgaW4gaXRzIGNvbGxlY3Rpb24sIGlmIG9uZSBjaG9zZW4uXHJcbiAgKiBAZmlyZXMgT3JiaXQjc2xpZGVjaGFuZ2VcclxuICAqL1xyXG4gIGNoYW5nZVNsaWRlKGlzTFRSLCBjaG9zZW5TbGlkZSwgaWR4KSB7XHJcbiAgICBpZiAoIXRoaXMuJHNsaWRlcykge3JldHVybjsgfSAvLyBEb24ndCBmcmVhayBvdXQgaWYgd2UncmUgaW4gdGhlIG1pZGRsZSBvZiBjbGVhbnVwXHJcbiAgICB2YXIgJGN1clNsaWRlID0gdGhpcy4kc2xpZGVzLmZpbHRlcignLmlzLWFjdGl2ZScpLmVxKDApO1xyXG5cclxuICAgIGlmICgvbXVpL2cudGVzdCgkY3VyU2xpZGVbMF0uY2xhc3NOYW1lKSkgeyByZXR1cm4gZmFsc2U7IH0gLy9pZiB0aGUgc2xpZGUgaXMgY3VycmVudGx5IGFuaW1hdGluZywga2ljayBvdXQgb2YgdGhlIGZ1bmN0aW9uXHJcblxyXG4gICAgdmFyICRmaXJzdFNsaWRlID0gdGhpcy4kc2xpZGVzLmZpcnN0KCksXHJcbiAgICAkbGFzdFNsaWRlID0gdGhpcy4kc2xpZGVzLmxhc3QoKSxcclxuICAgIGRpckluID0gaXNMVFIgPyAnUmlnaHQnIDogJ0xlZnQnLFxyXG4gICAgZGlyT3V0ID0gaXNMVFIgPyAnTGVmdCcgOiAnUmlnaHQnLFxyXG4gICAgX3RoaXMgPSB0aGlzLFxyXG4gICAgJG5ld1NsaWRlO1xyXG5cclxuICAgIGlmICghY2hvc2VuU2xpZGUpIHsgLy9tb3N0IG9mIHRoZSB0aW1lLCB0aGlzIHdpbGwgYmUgYXV0byBwbGF5ZWQgb3IgY2xpY2tlZCBmcm9tIHRoZSBuYXZCdXR0b25zLlxyXG4gICAgICAkbmV3U2xpZGUgPSBpc0xUUiA/IC8vaWYgd3JhcHBpbmcgZW5hYmxlZCwgY2hlY2sgdG8gc2VlIGlmIHRoZXJlIGlzIGEgYG5leHRgIG9yIGBwcmV2YCBzaWJsaW5nLCBpZiBub3QsIHNlbGVjdCB0aGUgZmlyc3Qgb3IgbGFzdCBzbGlkZSB0byBmaWxsIGluLiBpZiB3cmFwcGluZyBub3QgZW5hYmxlZCwgYXR0ZW1wdCB0byBzZWxlY3QgYG5leHRgIG9yIGBwcmV2YCwgaWYgdGhlcmUncyBub3RoaW5nIHRoZXJlLCB0aGUgZnVuY3Rpb24gd2lsbCBraWNrIG91dCBvbiBuZXh0IHN0ZXAuIENSQVpZIE5FU1RFRCBURVJOQVJJRVMhISEhIVxyXG4gICAgICAodGhpcy5vcHRpb25zLmluZmluaXRlV3JhcCA/ICRjdXJTbGlkZS5uZXh0KGAuJHt0aGlzLm9wdGlvbnMuc2xpZGVDbGFzc31gKS5sZW5ndGggPyAkY3VyU2xpZGUubmV4dChgLiR7dGhpcy5vcHRpb25zLnNsaWRlQ2xhc3N9YCkgOiAkZmlyc3RTbGlkZSA6ICRjdXJTbGlkZS5uZXh0KGAuJHt0aGlzLm9wdGlvbnMuc2xpZGVDbGFzc31gKSkvL3BpY2sgbmV4dCBzbGlkZSBpZiBtb3ZpbmcgbGVmdCB0byByaWdodFxyXG4gICAgICA6XHJcbiAgICAgICh0aGlzLm9wdGlvbnMuaW5maW5pdGVXcmFwID8gJGN1clNsaWRlLnByZXYoYC4ke3RoaXMub3B0aW9ucy5zbGlkZUNsYXNzfWApLmxlbmd0aCA/ICRjdXJTbGlkZS5wcmV2KGAuJHt0aGlzLm9wdGlvbnMuc2xpZGVDbGFzc31gKSA6ICRsYXN0U2xpZGUgOiAkY3VyU2xpZGUucHJldihgLiR7dGhpcy5vcHRpb25zLnNsaWRlQ2xhc3N9YCkpOy8vcGljayBwcmV2IHNsaWRlIGlmIG1vdmluZyByaWdodCB0byBsZWZ0XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAkbmV3U2xpZGUgPSBjaG9zZW5TbGlkZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoJG5ld1NsaWRlLmxlbmd0aCkge1xyXG4gICAgICAvKipcclxuICAgICAgKiBUcmlnZ2VycyBiZWZvcmUgdGhlIG5leHQgc2xpZGUgc3RhcnRzIGFuaW1hdGluZyBpbiBhbmQgb25seSBpZiBhIG5leHQgc2xpZGUgaGFzIGJlZW4gZm91bmQuXHJcbiAgICAgICogQGV2ZW50IE9yYml0I2JlZm9yZXNsaWRlY2hhbmdlXHJcbiAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignYmVmb3Jlc2xpZGVjaGFuZ2UuemYub3JiaXQnLCBbJGN1clNsaWRlLCAkbmV3U2xpZGVdKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuYnVsbGV0cykge1xyXG4gICAgICAgIGlkeCA9IGlkeCB8fCB0aGlzLiRzbGlkZXMuaW5kZXgoJG5ld1NsaWRlKTsgLy9ncmFiIGluZGV4IHRvIHVwZGF0ZSBidWxsZXRzXHJcbiAgICAgICAgdGhpcy5fdXBkYXRlQnVsbGV0cyhpZHgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnVzZU1VSSAmJiAhdGhpcy4kZWxlbWVudC5pcygnOmhpZGRlbicpKSB7XHJcbiAgICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZUluKFxyXG4gICAgICAgICAgJG5ld1NsaWRlLmFkZENsYXNzKCdpcy1hY3RpdmUnKS5jc3Moeydwb3NpdGlvbic6ICdhYnNvbHV0ZScsICd0b3AnOiAwfSksXHJcbiAgICAgICAgICB0aGlzLm9wdGlvbnNbYGFuaW1JbkZyb20ke2RpcklufWBdLFxyXG4gICAgICAgICAgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgJG5ld1NsaWRlLmNzcyh7J3Bvc2l0aW9uJzogJ3JlbGF0aXZlJywgJ2Rpc3BsYXknOiAnYmxvY2snfSlcclxuICAgICAgICAgICAgLmF0dHIoJ2FyaWEtbGl2ZScsICdwb2xpdGUnKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZU91dChcclxuICAgICAgICAgICRjdXJTbGlkZS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlJyksXHJcbiAgICAgICAgICB0aGlzLm9wdGlvbnNbYGFuaW1PdXRUbyR7ZGlyT3V0fWBdLFxyXG4gICAgICAgICAgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgJGN1clNsaWRlLnJlbW92ZUF0dHIoJ2FyaWEtbGl2ZScpO1xyXG4gICAgICAgICAgICBpZihfdGhpcy5vcHRpb25zLmF1dG9QbGF5ICYmICFfdGhpcy50aW1lci5pc1BhdXNlZCl7XHJcbiAgICAgICAgICAgICAgX3RoaXMudGltZXIucmVzdGFydCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vZG8gc3R1ZmY/XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAkY3VyU2xpZGUucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZSBpcy1pbicpLnJlbW92ZUF0dHIoJ2FyaWEtbGl2ZScpLmhpZGUoKTtcclxuICAgICAgICAkbmV3U2xpZGUuYWRkQ2xhc3MoJ2lzLWFjdGl2ZSBpcy1pbicpLmF0dHIoJ2FyaWEtbGl2ZScsICdwb2xpdGUnKS5zaG93KCk7XHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5hdXRvUGxheSAmJiAhdGhpcy50aW1lci5pc1BhdXNlZCkge1xyXG4gICAgICAgICAgdGhpcy50aW1lci5yZXN0YXJ0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAvKipcclxuICAgICogVHJpZ2dlcnMgd2hlbiB0aGUgc2xpZGUgaGFzIGZpbmlzaGVkIGFuaW1hdGluZyBpbi5cclxuICAgICogQGV2ZW50IE9yYml0I3NsaWRlY2hhbmdlXHJcbiAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3NsaWRlY2hhbmdlLnpmLm9yYml0JywgWyRuZXdTbGlkZV0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBVcGRhdGVzIHRoZSBhY3RpdmUgc3RhdGUgb2YgdGhlIGJ1bGxldHMsIGlmIGRpc3BsYXllZC5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqIEBwYXJhbSB7TnVtYmVyfSBpZHggLSB0aGUgaW5kZXggb2YgdGhlIGN1cnJlbnQgc2xpZGUuXHJcbiAgKi9cclxuICBfdXBkYXRlQnVsbGV0cyhpZHgpIHtcclxuICAgIHZhciAkb2xkQnVsbGV0ID0gdGhpcy4kZWxlbWVudC5maW5kKGAuJHt0aGlzLm9wdGlvbnMuYm94T2ZCdWxsZXRzfWApXHJcbiAgICAuZmluZCgnLmlzLWFjdGl2ZScpLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUnKS5ibHVyKCksXHJcbiAgICBzcGFuID0gJG9sZEJ1bGxldC5maW5kKCdzcGFuOmxhc3QnKS5kZXRhY2goKSxcclxuICAgICRuZXdCdWxsZXQgPSB0aGlzLiRidWxsZXRzLmVxKGlkeCkuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpLmFwcGVuZChzcGFuKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogRGVzdHJveXMgdGhlIGNhcm91c2VsIGFuZCBoaWRlcyB0aGUgZWxlbWVudC5cclxuICAqIEBmdW5jdGlvblxyXG4gICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYub3JiaXQnKS5maW5kKCcqJykub2ZmKCcuemYub3JiaXQnKS5lbmQoKS5oaWRlKCk7XHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5PcmJpdC5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAqIFRlbGxzIHRoZSBKUyB0byBsb29rIGZvciBhbmQgbG9hZEJ1bGxldHMuXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICBidWxsZXRzOiB0cnVlLFxyXG4gIC8qKlxyXG4gICogVGVsbHMgdGhlIEpTIHRvIGFwcGx5IGV2ZW50IGxpc3RlbmVycyB0byBuYXYgYnV0dG9uc1xyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgbmF2QnV0dG9uczogdHJ1ZSxcclxuICAvKipcclxuICAqIG1vdGlvbi11aSBhbmltYXRpb24gY2xhc3MgdG8gYXBwbHlcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdzbGlkZS1pbi1yaWdodCdcclxuICAqL1xyXG4gIGFuaW1JbkZyb21SaWdodDogJ3NsaWRlLWluLXJpZ2h0JyxcclxuICAvKipcclxuICAqIG1vdGlvbi11aSBhbmltYXRpb24gY2xhc3MgdG8gYXBwbHlcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdzbGlkZS1vdXQtcmlnaHQnXHJcbiAgKi9cclxuICBhbmltT3V0VG9SaWdodDogJ3NsaWRlLW91dC1yaWdodCcsXHJcbiAgLyoqXHJcbiAgKiBtb3Rpb24tdWkgYW5pbWF0aW9uIGNsYXNzIHRvIGFwcGx5XHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnc2xpZGUtaW4tbGVmdCdcclxuICAqXHJcbiAgKi9cclxuICBhbmltSW5Gcm9tTGVmdDogJ3NsaWRlLWluLWxlZnQnLFxyXG4gIC8qKlxyXG4gICogbW90aW9uLXVpIGFuaW1hdGlvbiBjbGFzcyB0byBhcHBseVxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ3NsaWRlLW91dC1sZWZ0J1xyXG4gICovXHJcbiAgYW5pbU91dFRvTGVmdDogJ3NsaWRlLW91dC1sZWZ0JyxcclxuICAvKipcclxuICAqIEFsbG93cyBPcmJpdCB0byBhdXRvbWF0aWNhbGx5IGFuaW1hdGUgb24gcGFnZSBsb2FkLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgYXV0b1BsYXk6IHRydWUsXHJcbiAgLyoqXHJcbiAgKiBBbW91bnQgb2YgdGltZSwgaW4gbXMsIGJldHdlZW4gc2xpZGUgdHJhbnNpdGlvbnNcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIDUwMDBcclxuICAqL1xyXG4gIHRpbWVyRGVsYXk6IDUwMDAsXHJcbiAgLyoqXHJcbiAgKiBBbGxvd3MgT3JiaXQgdG8gaW5maW5pdGVseSBsb29wIHRocm91Z2ggdGhlIHNsaWRlc1xyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgaW5maW5pdGVXcmFwOiB0cnVlLFxyXG4gIC8qKlxyXG4gICogQWxsb3dzIHRoZSBPcmJpdCBzbGlkZXMgdG8gYmluZCB0byBzd2lwZSBldmVudHMgZm9yIG1vYmlsZSwgcmVxdWlyZXMgYW4gYWRkaXRpb25hbCB1dGlsIGxpYnJhcnlcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIHN3aXBlOiB0cnVlLFxyXG4gIC8qKlxyXG4gICogQWxsb3dzIHRoZSB0aW1pbmcgZnVuY3Rpb24gdG8gcGF1c2UgYW5pbWF0aW9uIG9uIGhvdmVyLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgcGF1c2VPbkhvdmVyOiB0cnVlLFxyXG4gIC8qKlxyXG4gICogQWxsb3dzIE9yYml0IHRvIGJpbmQga2V5Ym9hcmQgZXZlbnRzIHRvIHRoZSBzbGlkZXIsIHRvIGFuaW1hdGUgZnJhbWVzIHdpdGggYXJyb3cga2V5c1xyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgYWNjZXNzaWJsZTogdHJ1ZSxcclxuICAvKipcclxuICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGNvbnRhaW5lciBvZiBPcmJpdFxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ29yYml0LWNvbnRhaW5lcidcclxuICAqL1xyXG4gIGNvbnRhaW5lckNsYXNzOiAnb3JiaXQtY29udGFpbmVyJyxcclxuICAvKipcclxuICAqIENsYXNzIGFwcGxpZWQgdG8gaW5kaXZpZHVhbCBzbGlkZXMuXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnb3JiaXQtc2xpZGUnXHJcbiAgKi9cclxuICBzbGlkZUNsYXNzOiAnb3JiaXQtc2xpZGUnLFxyXG4gIC8qKlxyXG4gICogQ2xhc3MgYXBwbGllZCB0byB0aGUgYnVsbGV0IGNvbnRhaW5lci4gWW91J3JlIHdlbGNvbWUuXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnb3JiaXQtYnVsbGV0cydcclxuICAqL1xyXG4gIGJveE9mQnVsbGV0czogJ29yYml0LWJ1bGxldHMnLFxyXG4gIC8qKlxyXG4gICogQ2xhc3MgYXBwbGllZCB0byB0aGUgYG5leHRgIG5hdmlnYXRpb24gYnV0dG9uLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ29yYml0LW5leHQnXHJcbiAgKi9cclxuICBuZXh0Q2xhc3M6ICdvcmJpdC1uZXh0JyxcclxuICAvKipcclxuICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGBwcmV2aW91c2AgbmF2aWdhdGlvbiBidXR0b24uXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnb3JiaXQtcHJldmlvdXMnXHJcbiAgKi9cclxuICBwcmV2Q2xhc3M6ICdvcmJpdC1wcmV2aW91cycsXHJcbiAgLyoqXHJcbiAgKiBCb29sZWFuIHRvIGZsYWcgdGhlIGpzIHRvIHVzZSBtb3Rpb24gdWkgY2xhc3NlcyBvciBub3QuIERlZmF1bHQgdG8gdHJ1ZSBmb3IgYmFja3dhcmRzIGNvbXBhdGFiaWxpdHkuXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICB1c2VNVUk6IHRydWVcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKE9yYml0LCAnT3JiaXQnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBSZXNwb25zaXZlTWVudSBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5yZXNwb25zaXZlTWVudVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmFjY29yZGlvbk1lbnVcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5kcmlsbGRvd25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5kcm9wZG93bi1tZW51XHJcbiAqL1xyXG5cclxuY2xhc3MgUmVzcG9uc2l2ZU1lbnUge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYSByZXNwb25zaXZlIG1lbnUuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIFJlc3BvbnNpdmVNZW51I2luaXRcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGEgZHJvcGRvd24gbWVudS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9ICQoZWxlbWVudCk7XHJcbiAgICB0aGlzLnJ1bGVzID0gdGhpcy4kZWxlbWVudC5kYXRhKCdyZXNwb25zaXZlLW1lbnUnKTtcclxuICAgIHRoaXMuY3VycmVudE1xID0gbnVsbDtcclxuICAgIHRoaXMuY3VycmVudFBsdWdpbiA9IG51bGw7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnUmVzcG9uc2l2ZU1lbnUnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBNZW51IGJ5IHBhcnNpbmcgdGhlIGNsYXNzZXMgZnJvbSB0aGUgJ2RhdGEtUmVzcG9uc2l2ZU1lbnUnIGF0dHJpYnV0ZSBvbiB0aGUgZWxlbWVudC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgLy8gVGhlIGZpcnN0IHRpbWUgYW4gSW50ZXJjaGFuZ2UgcGx1Z2luIGlzIGluaXRpYWxpemVkLCB0aGlzLnJ1bGVzIGlzIGNvbnZlcnRlZCBmcm9tIGEgc3RyaW5nIG9mIFwiY2xhc3Nlc1wiIHRvIGFuIG9iamVjdCBvZiBydWxlc1xyXG4gICAgaWYgKHR5cGVvZiB0aGlzLnJ1bGVzID09PSAnc3RyaW5nJykge1xyXG4gICAgICBsZXQgcnVsZXNUcmVlID0ge307XHJcblxyXG4gICAgICAvLyBQYXJzZSBydWxlcyBmcm9tIFwiY2xhc3Nlc1wiIHB1bGxlZCBmcm9tIGRhdGEgYXR0cmlidXRlXHJcbiAgICAgIGxldCBydWxlcyA9IHRoaXMucnVsZXMuc3BsaXQoJyAnKTtcclxuXHJcbiAgICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBldmVyeSBydWxlIGZvdW5kXHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBsZXQgcnVsZSA9IHJ1bGVzW2ldLnNwbGl0KCctJyk7XHJcbiAgICAgICAgbGV0IHJ1bGVTaXplID0gcnVsZS5sZW5ndGggPiAxID8gcnVsZVswXSA6ICdzbWFsbCc7XHJcbiAgICAgICAgbGV0IHJ1bGVQbHVnaW4gPSBydWxlLmxlbmd0aCA+IDEgPyBydWxlWzFdIDogcnVsZVswXTtcclxuXHJcbiAgICAgICAgaWYgKE1lbnVQbHVnaW5zW3J1bGVQbHVnaW5dICE9PSBudWxsKSB7XHJcbiAgICAgICAgICBydWxlc1RyZWVbcnVsZVNpemVdID0gTWVudVBsdWdpbnNbcnVsZVBsdWdpbl07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLnJ1bGVzID0gcnVsZXNUcmVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghJC5pc0VtcHR5T2JqZWN0KHRoaXMucnVsZXMpKSB7XHJcbiAgICAgIHRoaXMuX2NoZWNrTWVkaWFRdWVyaWVzKCk7XHJcbiAgICB9XHJcbiAgICAvLyBBZGQgZGF0YS1tdXRhdGUgc2luY2UgY2hpbGRyZW4gbWF5IG5lZWQgaXQuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2RhdGEtbXV0YXRlJywgKHRoaXMuJGVsZW1lbnQuYXR0cignZGF0YS1tdXRhdGUnKSB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdyZXNwb25zaXZlLW1lbnUnKSkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgZXZlbnRzIGZvciB0aGUgTWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgICQod2luZG93KS5vbignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgIF90aGlzLl9jaGVja01lZGlhUXVlcmllcygpO1xyXG4gICAgfSk7XHJcbiAgICAvLyAkKHdpbmRvdykub24oJ3Jlc2l6ZS56Zi5SZXNwb25zaXZlTWVudScsIGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gICBfdGhpcy5fY2hlY2tNZWRpYVF1ZXJpZXMoKTtcclxuICAgIC8vIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIHRoZSBjdXJyZW50IHNjcmVlbiB3aWR0aCBhZ2FpbnN0IGF2YWlsYWJsZSBtZWRpYSBxdWVyaWVzLiBJZiB0aGUgbWVkaWEgcXVlcnkgaGFzIGNoYW5nZWQsIGFuZCB0aGUgcGx1Z2luIG5lZWRlZCBoYXMgY2hhbmdlZCwgdGhlIHBsdWdpbnMgd2lsbCBzd2FwIG91dC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9jaGVja01lZGlhUXVlcmllcygpIHtcclxuICAgIHZhciBtYXRjaGVkTXEsIF90aGlzID0gdGhpcztcclxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBlYWNoIHJ1bGUgYW5kIGZpbmQgdGhlIGxhc3QgbWF0Y2hpbmcgcnVsZVxyXG4gICAgJC5lYWNoKHRoaXMucnVsZXMsIGZ1bmN0aW9uKGtleSkge1xyXG4gICAgICBpZiAoRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmF0TGVhc3Qoa2V5KSkge1xyXG4gICAgICAgIG1hdGNoZWRNcSA9IGtleTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTm8gbWF0Y2g/IE5vIGRpY2VcclxuICAgIGlmICghbWF0Y2hlZE1xKSByZXR1cm47XHJcblxyXG4gICAgLy8gUGx1Z2luIGFscmVhZHkgaW5pdGlhbGl6ZWQ/IFdlIGdvb2RcclxuICAgIGlmICh0aGlzLmN1cnJlbnRQbHVnaW4gaW5zdGFuY2VvZiB0aGlzLnJ1bGVzW21hdGNoZWRNcV0ucGx1Z2luKSByZXR1cm47XHJcblxyXG4gICAgLy8gUmVtb3ZlIGV4aXN0aW5nIHBsdWdpbi1zcGVjaWZpYyBDU1MgY2xhc3Nlc1xyXG4gICAgJC5lYWNoKE1lbnVQbHVnaW5zLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XHJcbiAgICAgIF90aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHZhbHVlLmNzc0NsYXNzKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCB0aGUgQ1NTIGNsYXNzIGZvciB0aGUgbmV3IHBsdWdpblxyXG4gICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLnJ1bGVzW21hdGNoZWRNcV0uY3NzQ2xhc3MpO1xyXG5cclxuICAgIC8vIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiB0aGUgbmV3IHBsdWdpblxyXG4gICAgaWYgKHRoaXMuY3VycmVudFBsdWdpbikgdGhpcy5jdXJyZW50UGx1Z2luLmRlc3Ryb3koKTtcclxuICAgIHRoaXMuY3VycmVudFBsdWdpbiA9IG5ldyB0aGlzLnJ1bGVzW21hdGNoZWRNcV0ucGx1Z2luKHRoaXMuJGVsZW1lbnQsIHt9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBpbnN0YW5jZSBvZiB0aGUgY3VycmVudCBwbHVnaW4gb24gdGhpcyBlbGVtZW50LCBhcyB3ZWxsIGFzIHRoZSB3aW5kb3cgcmVzaXplIGhhbmRsZXIgdGhhdCBzd2l0Y2hlcyB0aGUgcGx1Z2lucyBvdXQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuY3VycmVudFBsdWdpbi5kZXN0cm95KCk7XHJcbiAgICAkKHdpbmRvdykub2ZmKCcuemYuUmVzcG9uc2l2ZU1lbnUnKTtcclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcblJlc3BvbnNpdmVNZW51LmRlZmF1bHRzID0ge307XHJcblxyXG4vLyBUaGUgcGx1Z2luIG1hdGNoZXMgdGhlIHBsdWdpbiBjbGFzc2VzIHdpdGggdGhlc2UgcGx1Z2luIGluc3RhbmNlcy5cclxudmFyIE1lbnVQbHVnaW5zID0ge1xyXG4gIGRyb3Bkb3duOiB7XHJcbiAgICBjc3NDbGFzczogJ2Ryb3Bkb3duJyxcclxuICAgIHBsdWdpbjogRm91bmRhdGlvbi5fcGx1Z2luc1snZHJvcGRvd24tbWVudSddIHx8IG51bGxcclxuICB9LFxyXG4gZHJpbGxkb3duOiB7XHJcbiAgICBjc3NDbGFzczogJ2RyaWxsZG93bicsXHJcbiAgICBwbHVnaW46IEZvdW5kYXRpb24uX3BsdWdpbnNbJ2RyaWxsZG93biddIHx8IG51bGxcclxuICB9LFxyXG4gIGFjY29yZGlvbjoge1xyXG4gICAgY3NzQ2xhc3M6ICdhY2NvcmRpb24tbWVudScsXHJcbiAgICBwbHVnaW46IEZvdW5kYXRpb24uX3BsdWdpbnNbJ2FjY29yZGlvbi1tZW51J10gfHwgbnVsbFxyXG4gIH1cclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFJlc3BvbnNpdmVNZW51LCAnUmVzcG9uc2l2ZU1lbnUnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBSZXNwb25zaXZlVG9nZ2xlIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnJlc3BvbnNpdmVUb2dnbGVcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqL1xyXG5cclxuY2xhc3MgUmVzcG9uc2l2ZVRvZ2dsZSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBUYWIgQmFyLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBSZXNwb25zaXZlVG9nZ2xlI2luaXRcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gYXR0YWNoIHRhYiBiYXIgZnVuY3Rpb25hbGl0eSB0by5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9ICQoZWxlbWVudCk7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgUmVzcG9uc2l2ZVRvZ2dsZS5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1Jlc3BvbnNpdmVUb2dnbGUnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSB0YWIgYmFyIGJ5IGZpbmRpbmcgdGhlIHRhcmdldCBlbGVtZW50LCB0b2dnbGluZyBlbGVtZW50LCBhbmQgcnVubmluZyB1cGRhdGUoKS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIHRhcmdldElEID0gdGhpcy4kZWxlbWVudC5kYXRhKCdyZXNwb25zaXZlLXRvZ2dsZScpO1xyXG4gICAgaWYgKCF0YXJnZXRJRCkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdZb3VyIHRhYiBiYXIgbmVlZHMgYW4gSUQgb2YgYSBNZW51IGFzIHRoZSB2YWx1ZSBvZiBkYXRhLXRhYi1iYXIuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kdGFyZ2V0TWVudSA9ICQoYCMke3RhcmdldElEfWApO1xyXG4gICAgdGhpcy4kdG9nZ2xlciA9IHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtdG9nZ2xlXScpO1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIHRoaXMub3B0aW9ucywgdGhpcy4kdGFyZ2V0TWVudS5kYXRhKCkpO1xyXG5cclxuICAgIC8vIElmIHRoZXkgd2VyZSBzZXQsIHBhcnNlIHRoZSBhbmltYXRpb24gY2xhc3Nlc1xyXG4gICAgaWYodGhpcy5vcHRpb25zLmFuaW1hdGUpIHtcclxuICAgICAgbGV0IGlucHV0ID0gdGhpcy5vcHRpb25zLmFuaW1hdGUuc3BsaXQoJyAnKTtcclxuXHJcbiAgICAgIHRoaXMuYW5pbWF0aW9uSW4gPSBpbnB1dFswXTtcclxuICAgICAgdGhpcy5hbmltYXRpb25PdXQgPSBpbnB1dFsxXSB8fCBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3VwZGF0ZSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBuZWNlc3NhcnkgZXZlbnQgaGFuZGxlcnMgZm9yIHRoZSB0YWIgYmFyIHRvIHdvcmsuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLl91cGRhdGVNcUhhbmRsZXIgPSB0aGlzLl91cGRhdGUuYmluZCh0aGlzKTtcclxuXHJcbiAgICAkKHdpbmRvdykub24oJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIHRoaXMuX3VwZGF0ZU1xSGFuZGxlcik7XHJcblxyXG4gICAgdGhpcy4kdG9nZ2xlci5vbignY2xpY2suemYucmVzcG9uc2l2ZVRvZ2dsZScsIHRoaXMudG9nZ2xlTWVudS5iaW5kKHRoaXMpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyB0aGUgY3VycmVudCBtZWRpYSBxdWVyeSB0byBkZXRlcm1pbmUgaWYgdGhlIHRhYiBiYXIgc2hvdWxkIGJlIHZpc2libGUgb3IgaGlkZGVuLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3VwZGF0ZSgpIHtcclxuICAgIC8vIE1vYmlsZVxyXG4gICAgaWYgKCFGb3VuZGF0aW9uLk1lZGlhUXVlcnkuYXRMZWFzdCh0aGlzLm9wdGlvbnMuaGlkZUZvcikpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5zaG93KCk7XHJcbiAgICAgIHRoaXMuJHRhcmdldE1lbnUuaGlkZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIERlc2t0b3BcclxuICAgIGVsc2Uge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmhpZGUoKTtcclxuICAgICAgdGhpcy4kdGFyZ2V0TWVudS5zaG93KCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHRoZSBlbGVtZW50IGF0dGFjaGVkIHRvIHRoZSB0YWIgYmFyLiBUaGUgdG9nZ2xlIG9ubHkgaGFwcGVucyBpZiB0aGUgc2NyZWVuIGlzIHNtYWxsIGVub3VnaCB0byBhbGxvdyBpdC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgUmVzcG9uc2l2ZVRvZ2dsZSN0b2dnbGVkXHJcbiAgICovXHJcbiAgdG9nZ2xlTWVudSgpIHtcclxuICAgIGlmICghRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmF0TGVhc3QodGhpcy5vcHRpb25zLmhpZGVGb3IpKSB7XHJcbiAgICAgIGlmKHRoaXMub3B0aW9ucy5hbmltYXRlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuJHRhcmdldE1lbnUuaXMoJzpoaWRkZW4nKSkge1xyXG4gICAgICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZUluKHRoaXMuJHRhcmdldE1lbnUsIHRoaXMuYW5pbWF0aW9uSW4sICgpID0+IHtcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIGVsZW1lbnQgYXR0YWNoZWQgdG8gdGhlIHRhYiBiYXIgdG9nZ2xlcy5cclxuICAgICAgICAgICAgICogQGV2ZW50IFJlc3BvbnNpdmVUb2dnbGUjdG9nZ2xlZFxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCd0b2dnbGVkLnpmLnJlc3BvbnNpdmVUb2dnbGUnKTtcclxuICAgICAgICAgICAgdGhpcy4kdGFyZ2V0TWVudS5maW5kKCdbZGF0YS1tdXRhdGVdJykudHJpZ2dlckhhbmRsZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVPdXQodGhpcy4kdGFyZ2V0TWVudSwgdGhpcy5hbmltYXRpb25PdXQsICgpID0+IHtcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIGVsZW1lbnQgYXR0YWNoZWQgdG8gdGhlIHRhYiBiYXIgdG9nZ2xlcy5cclxuICAgICAgICAgICAgICogQGV2ZW50IFJlc3BvbnNpdmVUb2dnbGUjdG9nZ2xlZFxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCd0b2dnbGVkLnpmLnJlc3BvbnNpdmVUb2dnbGUnKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICB0aGlzLiR0YXJnZXRNZW51LnRvZ2dsZSgwKTtcclxuICAgICAgICB0aGlzLiR0YXJnZXRNZW51LmZpbmQoJ1tkYXRhLW11dGF0ZV0nKS50cmlnZ2VyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJyk7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIGVsZW1lbnQgYXR0YWNoZWQgdG8gdGhlIHRhYiBiYXIgdG9nZ2xlcy5cclxuICAgICAgICAgKiBAZXZlbnQgUmVzcG9uc2l2ZVRvZ2dsZSN0b2dnbGVkXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCd0b2dnbGVkLnpmLnJlc3BvbnNpdmVUb2dnbGUnKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnJlc3BvbnNpdmVUb2dnbGUnKTtcclxuICAgIHRoaXMuJHRvZ2dsZXIub2ZmKCcuemYucmVzcG9uc2l2ZVRvZ2dsZScpO1xyXG5cclxuICAgICQod2luZG93KS5vZmYoJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIHRoaXMuX3VwZGF0ZU1xSGFuZGxlcik7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuUmVzcG9uc2l2ZVRvZ2dsZS5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBUaGUgYnJlYWtwb2ludCBhZnRlciB3aGljaCB0aGUgbWVudSBpcyBhbHdheXMgc2hvd24sIGFuZCB0aGUgdGFiIGJhciBpcyBoaWRkZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdtZWRpdW0nXHJcbiAgICovXHJcbiAgaGlkZUZvcjogJ21lZGl1bScsXHJcblxyXG4gIC8qKlxyXG4gICAqIFRvIGRlY2lkZSBpZiB0aGUgdG9nZ2xlIHNob3VsZCBiZSBhbmltYXRlZCBvciBub3QuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYW5pbWF0ZTogZmFsc2VcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFJlc3BvbnNpdmVUb2dnbGUsICdSZXNwb25zaXZlVG9nZ2xlJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogUmV2ZWFsIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnJldmVhbFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwuYm94XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uIGlmIHVzaW5nIGFuaW1hdGlvbnNcclxuICovXHJcblxyXG5jbGFzcyBSZXZlYWwge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgUmV2ZWFsLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byB1c2UgZm9yIHRoZSBtb2RhbC5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIG9wdGlvbmFsIHBhcmFtZXRlcnMuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgUmV2ZWFsLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnUmV2ZWFsJyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdSZXZlYWwnLCB7XHJcbiAgICAgICdFTlRFUic6ICdvcGVuJyxcclxuICAgICAgJ1NQQUNFJzogJ29wZW4nLFxyXG4gICAgICAnRVNDQVBFJzogJ2Nsb3NlJyxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIG1vZGFsIGJ5IGFkZGluZyB0aGUgb3ZlcmxheSBhbmQgY2xvc2UgYnV0dG9ucywgKGlmIHNlbGVjdGVkKS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdGhpcy5pZCA9IHRoaXMuJGVsZW1lbnQuYXR0cignaWQnKTtcclxuICAgIHRoaXMuaXNBY3RpdmUgPSBmYWxzZTtcclxuICAgIHRoaXMuY2FjaGVkID0ge21xOiBGb3VuZGF0aW9uLk1lZGlhUXVlcnkuY3VycmVudH07XHJcbiAgICB0aGlzLmlzTW9iaWxlID0gbW9iaWxlU25pZmYoKTtcclxuXHJcbiAgICB0aGlzLiRhbmNob3IgPSAkKGBbZGF0YS1vcGVuPVwiJHt0aGlzLmlkfVwiXWApLmxlbmd0aCA/ICQoYFtkYXRhLW9wZW49XCIke3RoaXMuaWR9XCJdYCkgOiAkKGBbZGF0YS10b2dnbGU9XCIke3RoaXMuaWR9XCJdYCk7XHJcbiAgICB0aGlzLiRhbmNob3IuYXR0cih7XHJcbiAgICAgICdhcmlhLWNvbnRyb2xzJzogdGhpcy5pZCxcclxuICAgICAgJ2FyaWEtaGFzcG9wdXAnOiB0cnVlLFxyXG4gICAgICAndGFiaW5kZXgnOiAwXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmZ1bGxTY3JlZW4gfHwgdGhpcy4kZWxlbWVudC5oYXNDbGFzcygnZnVsbCcpKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5mdWxsU2NyZWVuID0gdHJ1ZTtcclxuICAgICAgdGhpcy5vcHRpb25zLm92ZXJsYXkgPSBmYWxzZTtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcmxheSAmJiAhdGhpcy4kb3ZlcmxheSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5ID0gdGhpcy5fbWFrZU92ZXJsYXkodGhpcy5pZCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKHtcclxuICAgICAgICAncm9sZSc6ICdkaWFsb2cnLFxyXG4gICAgICAgICdhcmlhLWhpZGRlbic6IHRydWUsXHJcbiAgICAgICAgJ2RhdGEteWV0aS1ib3gnOiB0aGlzLmlkLFxyXG4gICAgICAgICdkYXRhLXJlc2l6ZSc6IHRoaXMuaWRcclxuICAgIH0pO1xyXG5cclxuICAgIGlmKHRoaXMuJG92ZXJsYXkpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5kZXRhY2goKS5hcHBlbmRUbyh0aGlzLiRvdmVybGF5KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuZGV0YWNoKCkuYXBwZW5kVG8oJCh0aGlzLm9wdGlvbnMuYXBwZW5kVG8pKTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcygnd2l0aG91dC1vdmVybGF5Jyk7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGVlcExpbmsgJiYgd2luZG93LmxvY2F0aW9uLmhhc2ggPT09ICggYCMke3RoaXMuaWR9YCkpIHtcclxuICAgICAgJCh3aW5kb3cpLm9uZSgnbG9hZC56Zi5yZXZlYWwnLCB0aGlzLm9wZW4uYmluZCh0aGlzKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGVzIGFuIG92ZXJsYXkgZGl2IHRvIGRpc3BsYXkgYmVoaW5kIHRoZSBtb2RhbC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9tYWtlT3ZlcmxheSgpIHtcclxuICAgIHJldHVybiAkKCc8ZGl2PjwvZGl2PicpXHJcbiAgICAgIC5hZGRDbGFzcygncmV2ZWFsLW92ZXJsYXknKVxyXG4gICAgICAuYXBwZW5kVG8odGhpcy5vcHRpb25zLmFwcGVuZFRvKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZXMgcG9zaXRpb24gb2YgbW9kYWxcclxuICAgKiBUT0RPOiAgRmlndXJlIG91dCBpZiB3ZSBhY3R1YWxseSBuZWVkIHRvIGNhY2hlIHRoZXNlIHZhbHVlcyBvciBpZiBpdCBkb2Vzbid0IG1hdHRlclxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3VwZGF0ZVBvc2l0aW9uKCkge1xyXG4gICAgdmFyIHdpZHRoID0gdGhpcy4kZWxlbWVudC5vdXRlcldpZHRoKCk7XHJcbiAgICB2YXIgb3V0ZXJXaWR0aCA9ICQod2luZG93KS53aWR0aCgpO1xyXG4gICAgdmFyIGhlaWdodCA9IHRoaXMuJGVsZW1lbnQub3V0ZXJIZWlnaHQoKTtcclxuICAgIHZhciBvdXRlckhlaWdodCA9ICQod2luZG93KS5oZWlnaHQoKTtcclxuICAgIHZhciBsZWZ0LCB0b3A7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmhPZmZzZXQgPT09ICdhdXRvJykge1xyXG4gICAgICBsZWZ0ID0gcGFyc2VJbnQoKG91dGVyV2lkdGggLSB3aWR0aCkgLyAyLCAxMCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsZWZ0ID0gcGFyc2VJbnQodGhpcy5vcHRpb25zLmhPZmZzZXQsIDEwKTtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudk9mZnNldCA9PT0gJ2F1dG8nKSB7XHJcbiAgICAgIGlmIChoZWlnaHQgPiBvdXRlckhlaWdodCkge1xyXG4gICAgICAgIHRvcCA9IHBhcnNlSW50KE1hdGgubWluKDEwMCwgb3V0ZXJIZWlnaHQgLyAxMCksIDEwKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0b3AgPSBwYXJzZUludCgob3V0ZXJIZWlnaHQgLSBoZWlnaHQpIC8gNCwgMTApO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0b3AgPSBwYXJzZUludCh0aGlzLm9wdGlvbnMudk9mZnNldCwgMTApO1xyXG4gICAgfVxyXG4gICAgdGhpcy4kZWxlbWVudC5jc3Moe3RvcDogdG9wICsgJ3B4J30pO1xyXG4gICAgLy8gb25seSB3b3JyeSBhYm91dCBsZWZ0IGlmIHdlIGRvbid0IGhhdmUgYW4gb3ZlcmxheSBvciB3ZSBoYXZlYSAgaG9yaXpvbnRhbCBvZmZzZXQsXHJcbiAgICAvLyBvdGhlcndpc2Ugd2UncmUgcGVyZmVjdGx5IGluIHRoZSBtaWRkbGVcclxuICAgIGlmKCF0aGlzLiRvdmVybGF5IHx8ICh0aGlzLm9wdGlvbnMuaE9mZnNldCAhPT0gJ2F1dG8nKSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmNzcyh7bGVmdDogbGVmdCArICdweCd9KTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5jc3Moe21hcmdpbjogJzBweCd9KTtcclxuICAgIH1cclxuXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIGZvciB0aGUgbW9kYWwuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uKHtcclxuICAgICAgJ29wZW4uemYudHJpZ2dlcic6IHRoaXMub3Blbi5iaW5kKHRoaXMpLFxyXG4gICAgICAnY2xvc2UuemYudHJpZ2dlcic6IChldmVudCwgJGVsZW1lbnQpID0+IHtcclxuICAgICAgICBpZiAoKGV2ZW50LnRhcmdldCA9PT0gX3RoaXMuJGVsZW1lbnRbMF0pIHx8XHJcbiAgICAgICAgICAgICgkKGV2ZW50LnRhcmdldCkucGFyZW50cygnW2RhdGEtY2xvc2FibGVdJylbMF0gPT09ICRlbGVtZW50KSkgeyAvLyBvbmx5IGNsb3NlIHJldmVhbCB3aGVuIGl0J3MgZXhwbGljaXRseSBjYWxsZWRcclxuICAgICAgICAgIHJldHVybiB0aGlzLmNsb3NlLmFwcGx5KHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgJ3RvZ2dsZS56Zi50cmlnZ2VyJzogdGhpcy50b2dnbGUuYmluZCh0aGlzKSxcclxuICAgICAgJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInOiBmdW5jdGlvbigpIHtcclxuICAgICAgICBfdGhpcy5fdXBkYXRlUG9zaXRpb24oKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHRoaXMuJGFuY2hvci5sZW5ndGgpIHtcclxuICAgICAgdGhpcy4kYW5jaG9yLm9uKCdrZXlkb3duLnpmLnJldmVhbCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoZS53aGljaCA9PT0gMTMgfHwgZS53aGljaCA9PT0gMzIpIHtcclxuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBfdGhpcy5vcGVuKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25DbGljayAmJiB0aGlzLm9wdGlvbnMub3ZlcmxheSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5Lm9mZignLnpmLnJldmVhbCcpLm9uKCdjbGljay56Zi5yZXZlYWwnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUudGFyZ2V0ID09PSBfdGhpcy4kZWxlbWVudFswXSB8fFxyXG4gICAgICAgICAgJC5jb250YWlucyhfdGhpcy4kZWxlbWVudFswXSwgZS50YXJnZXQpIHx8XHJcbiAgICAgICAgICAgICEkLmNvbnRhaW5zKGRvY3VtZW50LCBlLnRhcmdldCkpIHtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kZWVwTGluaykge1xyXG4gICAgICAkKHdpbmRvdykub24oYHBvcHN0YXRlLnpmLnJldmVhbDoke3RoaXMuaWR9YCwgdGhpcy5faGFuZGxlU3RhdGUuYmluZCh0aGlzKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGVzIG1vZGFsIG1ldGhvZHMgb24gYmFjay9mb3J3YXJkIGJ1dHRvbiBjbGlja3Mgb3IgYW55IG90aGVyIGV2ZW50IHRoYXQgdHJpZ2dlcnMgcG9wc3RhdGUuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaGFuZGxlU3RhdGUoZSkge1xyXG4gICAgaWYod2luZG93LmxvY2F0aW9uLmhhc2ggPT09ICggJyMnICsgdGhpcy5pZCkgJiYgIXRoaXMuaXNBY3RpdmUpeyB0aGlzLm9wZW4oKTsgfVxyXG4gICAgZWxzZXsgdGhpcy5jbG9zZSgpOyB9XHJcbiAgfVxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgdGhlIG1vZGFsIGNvbnRyb2xsZWQgYnkgYHRoaXMuJGFuY2hvcmAsIGFuZCBjbG9zZXMgYWxsIG90aGVycyBieSBkZWZhdWx0LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBSZXZlYWwjY2xvc2VtZVxyXG4gICAqIEBmaXJlcyBSZXZlYWwjb3BlblxyXG4gICAqL1xyXG4gIG9wZW4oKSB7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmRlZXBMaW5rKSB7XHJcbiAgICAgIHZhciBoYXNoID0gYCMke3RoaXMuaWR9YDtcclxuXHJcbiAgICAgIGlmICh3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUpIHtcclxuICAgICAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUobnVsbCwgbnVsbCwgaGFzaCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSBoYXNoO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5pc0FjdGl2ZSA9IHRydWU7XHJcblxyXG4gICAgLy8gTWFrZSBlbGVtZW50cyBpbnZpc2libGUsIGJ1dCByZW1vdmUgZGlzcGxheTogbm9uZSBzbyB3ZSBjYW4gZ2V0IHNpemUgYW5kIHBvc2l0aW9uaW5nXHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgICAgLmNzcyh7ICd2aXNpYmlsaXR5JzogJ2hpZGRlbicgfSlcclxuICAgICAgICAuc2hvdygpXHJcbiAgICAgICAgLnNjcm9sbFRvcCgwKTtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcmxheSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5LmNzcyh7J3Zpc2liaWxpdHknOiAnaGlkZGVuJ30pLnNob3coKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl91cGRhdGVQb3NpdGlvbigpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLmhpZGUoKVxyXG4gICAgICAuY3NzKHsgJ3Zpc2liaWxpdHknOiAnJyB9KTtcclxuXHJcbiAgICBpZih0aGlzLiRvdmVybGF5KSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkuY3NzKHsndmlzaWJpbGl0eSc6ICcnfSkuaGlkZSgpO1xyXG4gICAgICBpZih0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdmYXN0JykpIHtcclxuICAgICAgICB0aGlzLiRvdmVybGF5LmFkZENsYXNzKCdmYXN0Jyk7XHJcbiAgICAgIH0gZWxzZSBpZiAodGhpcy4kZWxlbWVudC5oYXNDbGFzcygnc2xvdycpKSB7XHJcbiAgICAgICAgdGhpcy4kb3ZlcmxheS5hZGRDbGFzcygnc2xvdycpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLm11bHRpcGxlT3BlbmVkKSB7XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBGaXJlcyBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIG1vZGFsIG9wZW5zLlxyXG4gICAgICAgKiBDbG9zZXMgYW55IG90aGVyIG1vZGFscyB0aGF0IGFyZSBjdXJyZW50bHkgb3BlblxyXG4gICAgICAgKiBAZXZlbnQgUmV2ZWFsI2Nsb3NlbWVcclxuICAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignY2xvc2VtZS56Zi5yZXZlYWwnLCB0aGlzLmlkKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGFkZFJldmVhbE9wZW5DbGFzc2VzKCkge1xyXG4gICAgICBpZiAoX3RoaXMuaXNNb2JpbGUpIHtcclxuICAgICAgICBpZighX3RoaXMub3JpZ2luYWxTY3JvbGxQb3MpIHtcclxuICAgICAgICAgIF90aGlzLm9yaWdpbmFsU2Nyb2xsUG9zID0gd2luZG93LnBhZ2VZT2Zmc2V0O1xyXG4gICAgICAgIH1cclxuICAgICAgICAkKCdodG1sLCBib2R5JykuYWRkQ2xhc3MoJ2lzLXJldmVhbC1vcGVuJyk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgJCgnYm9keScpLmFkZENsYXNzKCdpcy1yZXZlYWwtb3BlbicpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBNb3Rpb24gVUkgbWV0aG9kIG9mIHJldmVhbFxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hbmltYXRpb25Jbikge1xyXG4gICAgICBmdW5jdGlvbiBhZnRlckFuaW1hdGlvbigpe1xyXG4gICAgICAgIF90aGlzLiRlbGVtZW50XHJcbiAgICAgICAgICAuYXR0cih7XHJcbiAgICAgICAgICAgICdhcmlhLWhpZGRlbic6IGZhbHNlLFxyXG4gICAgICAgICAgICAndGFiaW5kZXgnOiAtMVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC5mb2N1cygpO1xyXG4gICAgICAgIGFkZFJldmVhbE9wZW5DbGFzc2VzKCk7XHJcbiAgICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC50cmFwRm9jdXMoX3RoaXMuJGVsZW1lbnQpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcmxheSkge1xyXG4gICAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVJbih0aGlzLiRvdmVybGF5LCAnZmFkZS1pbicpO1xyXG4gICAgICB9XHJcbiAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVJbih0aGlzLiRlbGVtZW50LCB0aGlzLm9wdGlvbnMuYW5pbWF0aW9uSW4sICgpID0+IHtcclxuICAgICAgICBpZih0aGlzLiRlbGVtZW50KSB7IC8vIHByb3RlY3QgYWdhaW5zdCBvYmplY3QgaGF2aW5nIGJlZW4gcmVtb3ZlZFxyXG4gICAgICAgICAgdGhpcy5mb2N1c2FibGVFbGVtZW50cyA9IEZvdW5kYXRpb24uS2V5Ym9hcmQuZmluZEZvY3VzYWJsZSh0aGlzLiRlbGVtZW50KTtcclxuICAgICAgICAgIGFmdGVyQW5pbWF0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8vIGpRdWVyeSBtZXRob2Qgb2YgcmV2ZWFsXHJcbiAgICBlbHNlIHtcclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5vdmVybGF5KSB7XHJcbiAgICAgICAgdGhpcy4kb3ZlcmxheS5zaG93KDApO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuc2hvdyh0aGlzLm9wdGlvbnMuc2hvd0RlbGF5KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBoYW5kbGUgYWNjZXNzaWJpbGl0eVxyXG4gICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAuYXR0cih7XHJcbiAgICAgICAgJ2FyaWEtaGlkZGVuJzogZmFsc2UsXHJcbiAgICAgICAgJ3RhYmluZGV4JzogLTFcclxuICAgICAgfSlcclxuICAgICAgLmZvY3VzKCk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnRyYXBGb2N1cyh0aGlzLiRlbGVtZW50KTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIG1vZGFsIGhhcyBzdWNjZXNzZnVsbHkgb3BlbmVkLlxyXG4gICAgICogQGV2ZW50IFJldmVhbCNvcGVuXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignb3Blbi56Zi5yZXZlYWwnKTtcclxuXHJcbiAgICBhZGRSZXZlYWxPcGVuQ2xhc3NlcygpO1xyXG5cclxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICB0aGlzLl9leHRyYUhhbmRsZXJzKCk7XHJcbiAgICB9LCAwKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXh0cmEgZXZlbnQgaGFuZGxlcnMgZm9yIHRoZSBib2R5IGFuZCB3aW5kb3cgaWYgbmVjZXNzYXJ5LlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V4dHJhSGFuZGxlcnMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgaWYoIXRoaXMuJGVsZW1lbnQpIHsgcmV0dXJuOyB9IC8vIElmIHdlJ3JlIGluIHRoZSBtaWRkbGUgb2YgY2xlYW51cCwgZG9uJ3QgZnJlYWsgb3V0XHJcbiAgICB0aGlzLmZvY3VzYWJsZUVsZW1lbnRzID0gRm91bmRhdGlvbi5LZXlib2FyZC5maW5kRm9jdXNhYmxlKHRoaXMuJGVsZW1lbnQpO1xyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLm92ZXJsYXkgJiYgdGhpcy5vcHRpb25zLmNsb3NlT25DbGljayAmJiAhdGhpcy5vcHRpb25zLmZ1bGxTY3JlZW4pIHtcclxuICAgICAgJCgnYm9keScpLm9uKCdjbGljay56Zi5yZXZlYWwnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUudGFyZ2V0ID09PSBfdGhpcy4kZWxlbWVudFswXSB8fFxyXG4gICAgICAgICAgJC5jb250YWlucyhfdGhpcy4kZWxlbWVudFswXSwgZS50YXJnZXQpIHx8XHJcbiAgICAgICAgICAgICEkLmNvbnRhaW5zKGRvY3VtZW50LCBlLnRhcmdldCkpIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uRXNjKSB7XHJcbiAgICAgICQod2luZG93KS5vbigna2V5ZG93bi56Zi5yZXZlYWwnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ1JldmVhbCcsIHtcclxuICAgICAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKF90aGlzLm9wdGlvbnMuY2xvc2VPbkVzYykge1xyXG4gICAgICAgICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgICAgICAgX3RoaXMuJGFuY2hvci5mb2N1cygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGxvY2sgZm9jdXMgd2l0aGluIG1vZGFsIHdoaWxlIHRhYmJpbmdcclxuICAgIHRoaXMuJGVsZW1lbnQub24oJ2tleWRvd24uemYucmV2ZWFsJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICB2YXIgJHRhcmdldCA9ICQodGhpcyk7XHJcbiAgICAgIC8vIGhhbmRsZSBrZXlib2FyZCBldmVudCB3aXRoIGtleWJvYXJkIHV0aWxcclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ1JldmVhbCcsIHtcclxuICAgICAgICBvcGVuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmIChfdGhpcy4kZWxlbWVudC5maW5kKCc6Zm9jdXMnKS5pcyhfdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1jbG9zZV0nKSkpIHtcclxuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHsgLy8gc2V0IGZvY3VzIGJhY2sgdG8gYW5jaG9yIGlmIGNsb3NlIGJ1dHRvbiBoYXMgYmVlbiBhY3RpdmF0ZWRcclxuICAgICAgICAgICAgICBfdGhpcy4kYW5jaG9yLmZvY3VzKCk7XHJcbiAgICAgICAgICAgIH0sIDEpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmICgkdGFyZ2V0LmlzKF90aGlzLmZvY3VzYWJsZUVsZW1lbnRzKSkgeyAvLyBkb250J3QgdHJpZ2dlciBpZiBhY3VhbCBlbGVtZW50IGhhcyBmb2N1cyAoaS5lLiBpbnB1dHMsIGxpbmtzLCAuLi4pXHJcbiAgICAgICAgICAgIF90aGlzLm9wZW4oKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmIChfdGhpcy5vcHRpb25zLmNsb3NlT25Fc2MpIHtcclxuICAgICAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgICAgICAgX3RoaXMuJGFuY2hvci5mb2N1cygpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24ocHJldmVudERlZmF1bHQpIHtcclxuICAgICAgICAgIGlmIChwcmV2ZW50RGVmYXVsdCkge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvc2VzIHRoZSBtb2RhbC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgUmV2ZWFsI2Nsb3NlZFxyXG4gICAqL1xyXG4gIGNsb3NlKCkge1xyXG4gICAgaWYgKCF0aGlzLmlzQWN0aXZlIHx8ICF0aGlzLiRlbGVtZW50LmlzKCc6dmlzaWJsZScpKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgLy8gTW90aW9uIFVJIG1ldGhvZCBvZiBoaWRpbmdcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYW5pbWF0aW9uT3V0KSB7XHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcmxheSkge1xyXG4gICAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVPdXQodGhpcy4kb3ZlcmxheSwgJ2ZhZGUtb3V0JywgZmluaXNoVXApO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIGZpbmlzaFVwKCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVPdXQodGhpcy4kZWxlbWVudCwgdGhpcy5vcHRpb25zLmFuaW1hdGlvbk91dCk7XHJcbiAgICB9XHJcbiAgICAvLyBqUXVlcnkgbWV0aG9kIG9mIGhpZGluZ1xyXG4gICAgZWxzZSB7XHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcmxheSkge1xyXG4gICAgICAgIHRoaXMuJG92ZXJsYXkuaGlkZSgwLCBmaW5pc2hVcCk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgZmluaXNoVXAoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy4kZWxlbWVudC5oaWRlKHRoaXMub3B0aW9ucy5oaWRlRGVsYXkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENvbmRpdGlvbmFscyB0byByZW1vdmUgZXh0cmEgZXZlbnQgbGlzdGVuZXJzIGFkZGVkIG9uIG9wZW5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbkVzYykge1xyXG4gICAgICAkKHdpbmRvdykub2ZmKCdrZXlkb3duLnpmLnJldmVhbCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLm92ZXJsYXkgJiYgdGhpcy5vcHRpb25zLmNsb3NlT25DbGljaykge1xyXG4gICAgICAkKCdib2R5Jykub2ZmKCdjbGljay56Zi5yZXZlYWwnKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZigna2V5ZG93bi56Zi5yZXZlYWwnKTtcclxuXHJcbiAgICBmdW5jdGlvbiBmaW5pc2hVcCgpIHtcclxuICAgICAgaWYgKF90aGlzLmlzTW9iaWxlKSB7XHJcbiAgICAgICAgJCgnaHRtbCwgYm9keScpLnJlbW92ZUNsYXNzKCdpcy1yZXZlYWwtb3BlbicpO1xyXG4gICAgICAgIGlmKF90aGlzLm9yaWdpbmFsU2Nyb2xsUG9zKSB7XHJcbiAgICAgICAgICAkKCdib2R5Jykuc2Nyb2xsVG9wKF90aGlzLm9yaWdpbmFsU2Nyb2xsUG9zKTtcclxuICAgICAgICAgIF90aGlzLm9yaWdpbmFsU2Nyb2xsUG9zID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgJCgnYm9keScpLnJlbW92ZUNsYXNzKCdpcy1yZXZlYWwtb3BlbicpO1xyXG4gICAgICB9XHJcblxyXG5cclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWxlYXNlRm9jdXMoX3RoaXMuJGVsZW1lbnQpO1xyXG5cclxuICAgICAgX3RoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1oaWRkZW4nLCB0cnVlKTtcclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAqIEZpcmVzIHdoZW4gdGhlIG1vZGFsIGlzIGRvbmUgY2xvc2luZy5cclxuICAgICAgKiBAZXZlbnQgUmV2ZWFsI2Nsb3NlZFxyXG4gICAgICAqL1xyXG4gICAgICBfdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjbG9zZWQuemYucmV2ZWFsJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIFJlc2V0cyB0aGUgbW9kYWwgY29udGVudFxyXG4gICAgKiBUaGlzIHByZXZlbnRzIGEgcnVubmluZyB2aWRlbyB0byBrZWVwIGdvaW5nIGluIHRoZSBiYWNrZ3JvdW5kXHJcbiAgICAqL1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5yZXNldE9uQ2xvc2UpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5odG1sKHRoaXMuJGVsZW1lbnQuaHRtbCgpKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmlzQWN0aXZlID0gZmFsc2U7XHJcbiAgICAgaWYgKF90aGlzLm9wdGlvbnMuZGVlcExpbmspIHtcclxuICAgICAgIGlmICh3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUpIHtcclxuICAgICAgICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKCcnLCBkb2N1bWVudC50aXRsZSwgd2luZG93LmxvY2F0aW9uLmhyZWYucmVwbGFjZShgIyR7dGhpcy5pZH1gLCAnJykpO1xyXG4gICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSAnJztcclxuICAgICAgIH1cclxuICAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHRoZSBvcGVuL2Nsb3NlZCBzdGF0ZSBvZiBhIG1vZGFsLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHRvZ2dsZSgpIHtcclxuICAgIGlmICh0aGlzLmlzQWN0aXZlKSB7XHJcbiAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMub3BlbigpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIGEgbW9kYWwuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcmxheSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmFwcGVuZFRvKCQodGhpcy5vcHRpb25zLmFwcGVuZFRvKSk7IC8vIG1vdmUgJGVsZW1lbnQgb3V0c2lkZSBvZiAkb3ZlcmxheSB0byBwcmV2ZW50IGVycm9yIHVucmVnaXN0ZXJQbHVnaW4oKVxyXG4gICAgICB0aGlzLiRvdmVybGF5LmhpZGUoKS5vZmYoKS5yZW1vdmUoKTtcclxuICAgIH1cclxuICAgIHRoaXMuJGVsZW1lbnQuaGlkZSgpLm9mZigpO1xyXG4gICAgdGhpcy4kYW5jaG9yLm9mZignLnpmJyk7XHJcbiAgICAkKHdpbmRvdykub2ZmKGAuemYucmV2ZWFsOiR7dGhpcy5pZH1gKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfTtcclxufVxyXG5cclxuUmV2ZWFsLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIE1vdGlvbi1VSSBjbGFzcyB0byB1c2UgZm9yIGFuaW1hdGVkIGVsZW1lbnRzLiBJZiBub25lIHVzZWQsIGRlZmF1bHRzIHRvIHNpbXBsZSBzaG93L2hpZGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdzbGlkZS1pbi1sZWZ0J1xyXG4gICAqL1xyXG4gIGFuaW1hdGlvbkluOiAnJyxcclxuICAvKipcclxuICAgKiBNb3Rpb24tVUkgY2xhc3MgdG8gdXNlIGZvciBhbmltYXRlZCBlbGVtZW50cy4gSWYgbm9uZSB1c2VkLCBkZWZhdWx0cyB0byBzaW1wbGUgc2hvdy9oaWRlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnc2xpZGUtb3V0LXJpZ2h0J1xyXG4gICAqL1xyXG4gIGFuaW1hdGlvbk91dDogJycsXHJcbiAgLyoqXHJcbiAgICogVGltZSwgaW4gbXMsIHRvIGRlbGF5IHRoZSBvcGVuaW5nIG9mIGEgbW9kYWwgYWZ0ZXIgYSBjbGljayBpZiBubyBhbmltYXRpb24gdXNlZC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTBcclxuICAgKi9cclxuICBzaG93RGVsYXk6IDAsXHJcbiAgLyoqXHJcbiAgICogVGltZSwgaW4gbXMsIHRvIGRlbGF5IHRoZSBjbG9zaW5nIG9mIGEgbW9kYWwgYWZ0ZXIgYSBjbGljayBpZiBubyBhbmltYXRpb24gdXNlZC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTBcclxuICAgKi9cclxuICBoaWRlRGVsYXk6IDAsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIGEgY2xpY2sgb24gdGhlIGJvZHkvb3ZlcmxheSB0byBjbG9zZSB0aGUgbW9kYWwuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbG9zZU9uQ2xpY2s6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBtb2RhbCB0byBjbG9zZSBpZiB0aGUgdXNlciBwcmVzc2VzIHRoZSBgRVNDQVBFYCBrZXkuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbG9zZU9uRXNjOiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIElmIHRydWUsIGFsbG93cyBtdWx0aXBsZSBtb2RhbHMgdG8gYmUgZGlzcGxheWVkIGF0IG9uY2UuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgbXVsdGlwbGVPcGVuZWQ6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIERpc3RhbmNlLCBpbiBwaXhlbHMsIHRoZSBtb2RhbCBzaG91bGQgcHVzaCBkb3duIGZyb20gdGhlIHRvcCBvZiB0aGUgc2NyZWVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBhdXRvXHJcbiAgICovXHJcbiAgdk9mZnNldDogJ2F1dG8nLFxyXG4gIC8qKlxyXG4gICAqIERpc3RhbmNlLCBpbiBwaXhlbHMsIHRoZSBtb2RhbCBzaG91bGQgcHVzaCBpbiBmcm9tIHRoZSBzaWRlIG9mIHRoZSBzY3JlZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGF1dG9cclxuICAgKi9cclxuICBoT2Zmc2V0OiAnYXV0bycsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBtb2RhbCB0byBiZSBmdWxsc2NyZWVuLCBjb21wbGV0ZWx5IGJsb2NraW5nIG91dCB0aGUgcmVzdCBvZiB0aGUgdmlldy4gSlMgY2hlY2tzIGZvciB0aGlzIGFzIHdlbGwuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZnVsbFNjcmVlbjogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogUGVyY2VudGFnZSBvZiBzY3JlZW4gaGVpZ2h0IHRoZSBtb2RhbCBzaG91bGQgcHVzaCB1cCBmcm9tIHRoZSBib3R0b20gb2YgdGhlIHZpZXcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEwXHJcbiAgICovXHJcbiAgYnRtT2Zmc2V0UGN0OiAxMCxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIG1vZGFsIHRvIGdlbmVyYXRlIGFuIG92ZXJsYXkgZGl2LCB3aGljaCB3aWxsIGNvdmVyIHRoZSB2aWV3IHdoZW4gbW9kYWwgb3BlbnMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBvdmVybGF5OiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgbW9kYWwgdG8gcmVtb3ZlIGFuZCByZWluamVjdCBtYXJrdXAgb24gY2xvc2UuIFNob3VsZCBiZSB0cnVlIGlmIHVzaW5nIHZpZGVvIGVsZW1lbnRzIHcvbyB1c2luZyBwcm92aWRlcidzIGFwaSwgb3RoZXJ3aXNlLCB2aWRlb3Mgd2lsbCBjb250aW51ZSB0byBwbGF5IGluIHRoZSBiYWNrZ3JvdW5kLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIHJlc2V0T25DbG9zZTogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBtb2RhbCB0byBhbHRlciB0aGUgdXJsIG9uIG9wZW4vY2xvc2UsIGFuZCBhbGxvd3MgdGhlIHVzZSBvZiB0aGUgYGJhY2tgIGJ1dHRvbiB0byBjbG9zZSBtb2RhbHMuIEFMU08sIGFsbG93cyBhIG1vZGFsIHRvIGF1dG8tbWFuaWFjYWxseSBvcGVuIG9uIHBhZ2UgbG9hZCBJRiB0aGUgaGFzaCA9PT0gdGhlIG1vZGFsJ3MgdXNlci1zZXQgaWQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZGVlcExpbms6IGZhbHNlLFxyXG4gICAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBtb2RhbCB0byBhcHBlbmQgdG8gY3VzdG9tIGRpdi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhcHBlbmRUbzogXCJib2R5XCJcclxuXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihSZXZlYWwsICdSZXZlYWwnKTtcclxuXHJcbmZ1bmN0aW9uIGlQaG9uZVNuaWZmKCkge1xyXG4gIHJldHVybiAvaVAoYWR8aG9uZXxvZCkuKk9TLy50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KTtcclxufVxyXG5cclxuZnVuY3Rpb24gYW5kcm9pZFNuaWZmKCkge1xyXG4gIHJldHVybiAvQW5kcm9pZC8udGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vYmlsZVNuaWZmKCkge1xyXG4gIHJldHVybiBpUGhvbmVTbmlmZigpIHx8IGFuZHJvaWRTbmlmZigpO1xyXG59XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogU2xpZGVyIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnNsaWRlclxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvblxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50b3VjaFxyXG4gKi9cclxuXHJcbmNsYXNzIFNsaWRlciB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhIHNsaWRlciBjb250cm9sLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYSBzbGlkZXIgY29udHJvbC5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgU2xpZGVyLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1NsaWRlcicpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignU2xpZGVyJywge1xyXG4gICAgICAnbHRyJzoge1xyXG4gICAgICAgICdBUlJPV19SSUdIVCc6ICdpbmNyZWFzZScsXHJcbiAgICAgICAgJ0FSUk9XX1VQJzogJ2luY3JlYXNlJyxcclxuICAgICAgICAnQVJST1dfRE9XTic6ICdkZWNyZWFzZScsXHJcbiAgICAgICAgJ0FSUk9XX0xFRlQnOiAnZGVjcmVhc2UnLFxyXG4gICAgICAgICdTSElGVF9BUlJPV19SSUdIVCc6ICdpbmNyZWFzZV9mYXN0JyxcclxuICAgICAgICAnU0hJRlRfQVJST1dfVVAnOiAnaW5jcmVhc2VfZmFzdCcsXHJcbiAgICAgICAgJ1NISUZUX0FSUk9XX0RPV04nOiAnZGVjcmVhc2VfZmFzdCcsXHJcbiAgICAgICAgJ1NISUZUX0FSUk9XX0xFRlQnOiAnZGVjcmVhc2VfZmFzdCdcclxuICAgICAgfSxcclxuICAgICAgJ3J0bCc6IHtcclxuICAgICAgICAnQVJST1dfTEVGVCc6ICdpbmNyZWFzZScsXHJcbiAgICAgICAgJ0FSUk9XX1JJR0hUJzogJ2RlY3JlYXNlJyxcclxuICAgICAgICAnU0hJRlRfQVJST1dfTEVGVCc6ICdpbmNyZWFzZV9mYXN0JyxcclxuICAgICAgICAnU0hJRlRfQVJST1dfUklHSFQnOiAnZGVjcmVhc2VfZmFzdCdcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWxpemVzIHRoZSBwbHVnaW4gYnkgcmVhZGluZy9zZXR0aW5nIGF0dHJpYnV0ZXMsIGNyZWF0aW5nIGNvbGxlY3Rpb25zIGFuZCBzZXR0aW5nIHRoZSBpbml0aWFsIHBvc2l0aW9uIG9mIHRoZSBoYW5kbGUocykuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHRoaXMuaW5wdXRzID0gdGhpcy4kZWxlbWVudC5maW5kKCdpbnB1dCcpO1xyXG4gICAgdGhpcy5oYW5kbGVzID0gdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1zbGlkZXItaGFuZGxlXScpO1xyXG5cclxuICAgIHRoaXMuJGhhbmRsZSA9IHRoaXMuaGFuZGxlcy5lcSgwKTtcclxuICAgIHRoaXMuJGlucHV0ID0gdGhpcy5pbnB1dHMubGVuZ3RoID8gdGhpcy5pbnB1dHMuZXEoMCkgOiAkKGAjJHt0aGlzLiRoYW5kbGUuYXR0cignYXJpYS1jb250cm9scycpfWApO1xyXG4gICAgdGhpcy4kZmlsbCA9IHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtc2xpZGVyLWZpbGxdJykuY3NzKHRoaXMub3B0aW9ucy52ZXJ0aWNhbCA/ICdoZWlnaHQnIDogJ3dpZHRoJywgMCk7XHJcblxyXG4gICAgdmFyIGlzRGJsID0gZmFsc2UsXHJcbiAgICAgICAgX3RoaXMgPSB0aGlzO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kaXNhYmxlZCB8fCB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKHRoaXMub3B0aW9ucy5kaXNhYmxlZENsYXNzKSkge1xyXG4gICAgICB0aGlzLm9wdGlvbnMuZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKHRoaXMub3B0aW9ucy5kaXNhYmxlZENsYXNzKTtcclxuICAgIH1cclxuICAgIGlmICghdGhpcy5pbnB1dHMubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXMuaW5wdXRzID0gJCgpLmFkZCh0aGlzLiRpbnB1dCk7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5iaW5kaW5nID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9zZXRJbml0QXR0cigwKTtcclxuXHJcbiAgICBpZiAodGhpcy5oYW5kbGVzWzFdKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5kb3VibGVTaWRlZCA9IHRydWU7XHJcbiAgICAgIHRoaXMuJGhhbmRsZTIgPSB0aGlzLmhhbmRsZXMuZXEoMSk7XHJcbiAgICAgIHRoaXMuJGlucHV0MiA9IHRoaXMuaW5wdXRzLmxlbmd0aCA+IDEgPyB0aGlzLmlucHV0cy5lcSgxKSA6ICQoYCMke3RoaXMuJGhhbmRsZTIuYXR0cignYXJpYS1jb250cm9scycpfWApO1xyXG5cclxuICAgICAgaWYgKCF0aGlzLmlucHV0c1sxXSkge1xyXG4gICAgICAgIHRoaXMuaW5wdXRzID0gdGhpcy5pbnB1dHMuYWRkKHRoaXMuJGlucHV0Mik7XHJcbiAgICAgIH1cclxuICAgICAgaXNEYmwgPSB0cnVlO1xyXG5cclxuICAgICAgLy8gdGhpcy4kaGFuZGxlLnRyaWdnZXJIYW5kbGVyKCdjbGljay56Zi5zbGlkZXInKTtcclxuICAgICAgdGhpcy5fc2V0SW5pdEF0dHIoMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU2V0IGhhbmRsZSBwb3NpdGlvbnNcclxuICAgIHRoaXMuc2V0SGFuZGxlcygpO1xyXG5cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgc2V0SGFuZGxlcygpIHtcclxuICAgIGlmKHRoaXMuaGFuZGxlc1sxXSkge1xyXG4gICAgICB0aGlzLl9zZXRIYW5kbGVQb3ModGhpcy4kaGFuZGxlLCB0aGlzLmlucHV0cy5lcSgwKS52YWwoKSwgdHJ1ZSwgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuX3NldEhhbmRsZVBvcyh0aGlzLiRoYW5kbGUyLCB0aGlzLmlucHV0cy5lcSgxKS52YWwoKSwgdHJ1ZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5fc2V0SGFuZGxlUG9zKHRoaXMuJGhhbmRsZSwgdGhpcy5pbnB1dHMuZXEoMCkudmFsKCksIHRydWUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgX3JlZmxvdygpIHtcclxuICAgIHRoaXMuc2V0SGFuZGxlcygpO1xyXG4gIH1cclxuICAvKipcclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtIGZsb2F0aW5nIHBvaW50ICh0aGUgdmFsdWUpIHRvIGJlIHRyYW5zZm9ybWVkIHVzaW5nIHRvIGEgcmVsYXRpdmUgcG9zaXRpb24gb24gdGhlIHNsaWRlciAodGhlIGludmVyc2Ugb2YgX3ZhbHVlKVxyXG4gICovXHJcbiAgX3BjdE9mQmFyKHZhbHVlKSB7XHJcbiAgICB2YXIgcGN0T2ZCYXIgPSBwZXJjZW50KHZhbHVlIC0gdGhpcy5vcHRpb25zLnN0YXJ0LCB0aGlzLm9wdGlvbnMuZW5kIC0gdGhpcy5vcHRpb25zLnN0YXJ0KVxyXG5cclxuICAgIHN3aXRjaCh0aGlzLm9wdGlvbnMucG9zaXRpb25WYWx1ZUZ1bmN0aW9uKSB7XHJcbiAgICBjYXNlIFwicG93XCI6XHJcbiAgICAgIHBjdE9mQmFyID0gdGhpcy5fbG9nVHJhbnNmb3JtKHBjdE9mQmFyKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwibG9nXCI6XHJcbiAgICAgIHBjdE9mQmFyID0gdGhpcy5fcG93VHJhbnNmb3JtKHBjdE9mQmFyKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHBjdE9mQmFyLnRvRml4ZWQoMilcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICogQHBhcmFtIHtOdW1iZXJ9IHBjdE9mQmFyIC0gZmxvYXRpbmcgcG9pbnQsIHRoZSByZWxhdGl2ZSBwb3NpdGlvbiBvZiB0aGUgc2xpZGVyICh0eXBpY2FsbHkgYmV0d2VlbiAwLTEpIHRvIGJlIHRyYW5zZm9ybWVkIHRvIGEgdmFsdWVcclxuICAqL1xyXG4gIF92YWx1ZShwY3RPZkJhcikge1xyXG4gICAgc3dpdGNoKHRoaXMub3B0aW9ucy5wb3NpdGlvblZhbHVlRnVuY3Rpb24pIHtcclxuICAgIGNhc2UgXCJwb3dcIjpcclxuICAgICAgcGN0T2ZCYXIgPSB0aGlzLl9wb3dUcmFuc2Zvcm0ocGN0T2ZCYXIpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJsb2dcIjpcclxuICAgICAgcGN0T2ZCYXIgPSB0aGlzLl9sb2dUcmFuc2Zvcm0ocGN0T2ZCYXIpO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuICAgIHZhciB2YWx1ZSA9ICh0aGlzLm9wdGlvbnMuZW5kIC0gdGhpcy5vcHRpb25zLnN0YXJ0KSAqIHBjdE9mQmFyICsgdGhpcy5vcHRpb25zLnN0YXJ0O1xyXG5cclxuICAgIHJldHVybiB2YWx1ZVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSBmbG9hdGluZyBwb2ludCAodHlwaWNhbGx5IGJldHdlZW4gMC0xKSB0byBiZSB0cmFuc2Zvcm1lZCB1c2luZyB0aGUgbG9nIGZ1bmN0aW9uXHJcbiAgKi9cclxuICBfbG9nVHJhbnNmb3JtKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gYmFzZUxvZyh0aGlzLm9wdGlvbnMubm9uTGluZWFyQmFzZSwgKCh2YWx1ZSoodGhpcy5vcHRpb25zLm5vbkxpbmVhckJhc2UtMSkpKzEpKVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSBmbG9hdGluZyBwb2ludCAodHlwaWNhbGx5IGJldHdlZW4gMC0xKSB0byBiZSB0cmFuc2Zvcm1lZCB1c2luZyB0aGUgcG93ZXIgZnVuY3Rpb25cclxuICAqL1xyXG4gIF9wb3dUcmFuc2Zvcm0odmFsdWUpIHtcclxuICAgIHJldHVybiAoTWF0aC5wb3codGhpcy5vcHRpb25zLm5vbkxpbmVhckJhc2UsIHZhbHVlKSAtIDEpIC8gKHRoaXMub3B0aW9ucy5ub25MaW5lYXJCYXNlIC0gMSlcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHBvc2l0aW9uIG9mIHRoZSBzZWxlY3RlZCBoYW5kbGUgYW5kIGZpbGwgYmFyLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRobmRsIC0gdGhlIHNlbGVjdGVkIGhhbmRsZSB0byBtb3ZlLlxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBsb2NhdGlvbiAtIGZsb2F0aW5nIHBvaW50IGJldHdlZW4gdGhlIHN0YXJ0IGFuZCBlbmQgdmFsdWVzIG9mIHRoZSBzbGlkZXIgYmFyLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gY2FsbGJhY2sgZnVuY3Rpb24gdG8gZmlyZSBvbiBjb21wbGV0aW9uLlxyXG4gICAqIEBmaXJlcyBTbGlkZXIjbW92ZWRcclxuICAgKiBAZmlyZXMgU2xpZGVyI2NoYW5nZWRcclxuICAgKi9cclxuICBfc2V0SGFuZGxlUG9zKCRobmRsLCBsb2NhdGlvbiwgbm9JbnZlcnQsIGNiKSB7XHJcbiAgICAvLyBkb24ndCBtb3ZlIGlmIHRoZSBzbGlkZXIgaGFzIGJlZW4gZGlzYWJsZWQgc2luY2UgaXRzIGluaXRpYWxpemF0aW9uXHJcbiAgICBpZiAodGhpcy4kZWxlbWVudC5oYXNDbGFzcyh0aGlzLm9wdGlvbnMuZGlzYWJsZWRDbGFzcykpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgLy9taWdodCBuZWVkIHRvIGFsdGVyIHRoYXQgc2xpZ2h0bHkgZm9yIGJhcnMgdGhhdCB3aWxsIGhhdmUgb2RkIG51bWJlciBzZWxlY3Rpb25zLlxyXG4gICAgbG9jYXRpb24gPSBwYXJzZUZsb2F0KGxvY2F0aW9uKTsvL29uIGlucHV0IGNoYW5nZSBldmVudHMsIGNvbnZlcnQgc3RyaW5nIHRvIG51bWJlci4uLmdydW1ibGUuXHJcblxyXG4gICAgLy8gcHJldmVudCBzbGlkZXIgZnJvbSBydW5uaW5nIG91dCBvZiBib3VuZHMsIGlmIHZhbHVlIGV4Y2VlZHMgdGhlIGxpbWl0cyBzZXQgdGhyb3VnaCBvcHRpb25zLCBvdmVycmlkZSB0aGUgdmFsdWUgdG8gbWluL21heFxyXG4gICAgaWYgKGxvY2F0aW9uIDwgdGhpcy5vcHRpb25zLnN0YXJ0KSB7IGxvY2F0aW9uID0gdGhpcy5vcHRpb25zLnN0YXJ0OyB9XHJcbiAgICBlbHNlIGlmIChsb2NhdGlvbiA+IHRoaXMub3B0aW9ucy5lbmQpIHsgbG9jYXRpb24gPSB0aGlzLm9wdGlvbnMuZW5kOyB9XHJcblxyXG4gICAgdmFyIGlzRGJsID0gdGhpcy5vcHRpb25zLmRvdWJsZVNpZGVkO1xyXG5cclxuICAgIGlmIChpc0RibCkgeyAvL3RoaXMgYmxvY2sgaXMgdG8gcHJldmVudCAyIGhhbmRsZXMgZnJvbSBjcm9zc2luZyBlYWNob3RoZXIuIENvdWxkL3Nob3VsZCBiZSBpbXByb3ZlZC5cclxuICAgICAgaWYgKHRoaXMuaGFuZGxlcy5pbmRleCgkaG5kbCkgPT09IDApIHtcclxuICAgICAgICB2YXIgaDJWYWwgPSBwYXJzZUZsb2F0KHRoaXMuJGhhbmRsZTIuYXR0cignYXJpYS12YWx1ZW5vdycpKTtcclxuICAgICAgICBsb2NhdGlvbiA9IGxvY2F0aW9uID49IGgyVmFsID8gaDJWYWwgLSB0aGlzLm9wdGlvbnMuc3RlcCA6IGxvY2F0aW9uO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciBoMVZhbCA9IHBhcnNlRmxvYXQodGhpcy4kaGFuZGxlLmF0dHIoJ2FyaWEtdmFsdWVub3cnKSk7XHJcbiAgICAgICAgbG9jYXRpb24gPSBsb2NhdGlvbiA8PSBoMVZhbCA/IGgxVmFsICsgdGhpcy5vcHRpb25zLnN0ZXAgOiBsb2NhdGlvbjtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vdGhpcyBpcyBmb3Igc2luZ2xlLWhhbmRsZWQgdmVydGljYWwgc2xpZGVycywgaXQgYWRqdXN0cyB0aGUgdmFsdWUgdG8gYWNjb3VudCBmb3IgdGhlIHNsaWRlciBiZWluZyBcInVwc2lkZS1kb3duXCJcclxuICAgIC8vZm9yIGNsaWNrIGFuZCBkcmFnIGV2ZW50cywgaXQncyB3ZWlyZCBkdWUgdG8gdGhlIHNjYWxlKC0xLCAxKSBjc3MgcHJvcGVydHlcclxuICAgIGlmICh0aGlzLm9wdGlvbnMudmVydGljYWwgJiYgIW5vSW52ZXJ0KSB7XHJcbiAgICAgIGxvY2F0aW9uID0gdGhpcy5vcHRpb25zLmVuZCAtIGxvY2F0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgdmVydCA9IHRoaXMub3B0aW9ucy52ZXJ0aWNhbCxcclxuICAgICAgICBoT3JXID0gdmVydCA/ICdoZWlnaHQnIDogJ3dpZHRoJyxcclxuICAgICAgICBsT3JUID0gdmVydCA/ICd0b3AnIDogJ2xlZnQnLFxyXG4gICAgICAgIGhhbmRsZURpbSA9ICRobmRsWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpW2hPclddLFxyXG4gICAgICAgIGVsZW1EaW0gPSB0aGlzLiRlbGVtZW50WzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpW2hPclddLFxyXG4gICAgICAgIC8vcGVyY2VudGFnZSBvZiBiYXIgbWluL21heCB2YWx1ZSBiYXNlZCBvbiBjbGljayBvciBkcmFnIHBvaW50XHJcbiAgICAgICAgcGN0T2ZCYXIgPSB0aGlzLl9wY3RPZkJhcihsb2NhdGlvbiksXHJcbiAgICAgICAgLy9udW1iZXIgb2YgYWN0dWFsIHBpeGVscyB0byBzaGlmdCB0aGUgaGFuZGxlLCBiYXNlZCBvbiB0aGUgcGVyY2VudGFnZSBvYnRhaW5lZCBhYm92ZVxyXG4gICAgICAgIHB4VG9Nb3ZlID0gKGVsZW1EaW0gLSBoYW5kbGVEaW0pICogcGN0T2ZCYXIsXHJcbiAgICAgICAgLy9wZXJjZW50YWdlIG9mIGJhciB0byBzaGlmdCB0aGUgaGFuZGxlXHJcbiAgICAgICAgbW92ZW1lbnQgPSAocGVyY2VudChweFRvTW92ZSwgZWxlbURpbSkgKiAxMDApLnRvRml4ZWQodGhpcy5vcHRpb25zLmRlY2ltYWwpO1xyXG4gICAgICAgIC8vZml4aW5nIHRoZSBkZWNpbWFsIHZhbHVlIGZvciB0aGUgbG9jYXRpb24gbnVtYmVyLCBpcyBwYXNzZWQgdG8gb3RoZXIgbWV0aG9kcyBhcyBhIGZpeGVkIGZsb2F0aW5nLXBvaW50IHZhbHVlXHJcbiAgICAgICAgbG9jYXRpb24gPSBwYXJzZUZsb2F0KGxvY2F0aW9uLnRvRml4ZWQodGhpcy5vcHRpb25zLmRlY2ltYWwpKTtcclxuICAgICAgICAvLyBkZWNsYXJlIGVtcHR5IG9iamVjdCBmb3IgY3NzIGFkanVzdG1lbnRzLCBvbmx5IHVzZWQgd2l0aCAyIGhhbmRsZWQtc2xpZGVyc1xyXG4gICAgdmFyIGNzcyA9IHt9O1xyXG5cclxuICAgIHRoaXMuX3NldFZhbHVlcygkaG5kbCwgbG9jYXRpb24pO1xyXG5cclxuICAgIC8vIFRPRE8gdXBkYXRlIHRvIGNhbGN1bGF0ZSBiYXNlZCBvbiB2YWx1ZXMgc2V0IHRvIHJlc3BlY3RpdmUgaW5wdXRzPz9cclxuICAgIGlmIChpc0RibCkge1xyXG4gICAgICB2YXIgaXNMZWZ0SG5kbCA9IHRoaXMuaGFuZGxlcy5pbmRleCgkaG5kbCkgPT09IDAsXHJcbiAgICAgICAgICAvL2VtcHR5IHZhcmlhYmxlLCB3aWxsIGJlIHVzZWQgZm9yIG1pbi1oZWlnaHQvd2lkdGggZm9yIGZpbGwgYmFyXHJcbiAgICAgICAgICBkaW0sXHJcbiAgICAgICAgICAvL3BlcmNlbnRhZ2Ugdy9oIG9mIHRoZSBoYW5kbGUgY29tcGFyZWQgdG8gdGhlIHNsaWRlciBiYXJcclxuICAgICAgICAgIGhhbmRsZVBjdCA9ICB+fihwZXJjZW50KGhhbmRsZURpbSwgZWxlbURpbSkgKiAxMDApO1xyXG4gICAgICAvL2lmIGxlZnQgaGFuZGxlLCB0aGUgbWF0aCBpcyBzbGlnaHRseSBkaWZmZXJlbnQgdGhhbiBpZiBpdCdzIHRoZSByaWdodCBoYW5kbGUsIGFuZCB0aGUgbGVmdC90b3AgcHJvcGVydHkgbmVlZHMgdG8gYmUgY2hhbmdlZCBmb3IgdGhlIGZpbGwgYmFyXHJcbiAgICAgIGlmIChpc0xlZnRIbmRsKSB7XHJcbiAgICAgICAgLy9sZWZ0IG9yIHRvcCBwZXJjZW50YWdlIHZhbHVlIHRvIGFwcGx5IHRvIHRoZSBmaWxsIGJhci5cclxuICAgICAgICBjc3NbbE9yVF0gPSBgJHttb3ZlbWVudH0lYDtcclxuICAgICAgICAvL2NhbGN1bGF0ZSB0aGUgbmV3IG1pbi1oZWlnaHQvd2lkdGggZm9yIHRoZSBmaWxsIGJhci5cclxuICAgICAgICBkaW0gPSBwYXJzZUZsb2F0KHRoaXMuJGhhbmRsZTJbMF0uc3R5bGVbbE9yVF0pIC0gbW92ZW1lbnQgKyBoYW5kbGVQY3Q7XHJcbiAgICAgICAgLy90aGlzIGNhbGxiYWNrIGlzIG5lY2Vzc2FyeSB0byBwcmV2ZW50IGVycm9ycyBhbmQgYWxsb3cgdGhlIHByb3BlciBwbGFjZW1lbnQgYW5kIGluaXRpYWxpemF0aW9uIG9mIGEgMi1oYW5kbGVkIHNsaWRlclxyXG4gICAgICAgIC8vcGx1cywgaXQgbWVhbnMgd2UgZG9uJ3QgY2FyZSBpZiAnZGltJyBpc05hTiBvbiBpbml0LCBpdCB3b24ndCBiZSBpbiB0aGUgZnV0dXJlLlxyXG4gICAgICAgIGlmIChjYiAmJiB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHsgY2IoKTsgfS8vdGhpcyBpcyBvbmx5IG5lZWRlZCBmb3IgdGhlIGluaXRpYWxpemF0aW9uIG9mIDIgaGFuZGxlZCBzbGlkZXJzXHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy9qdXN0IGNhY2hpbmcgdGhlIHZhbHVlIG9mIHRoZSBsZWZ0L2JvdHRvbSBoYW5kbGUncyBsZWZ0L3RvcCBwcm9wZXJ0eVxyXG4gICAgICAgIHZhciBoYW5kbGVQb3MgPSBwYXJzZUZsb2F0KHRoaXMuJGhhbmRsZVswXS5zdHlsZVtsT3JUXSk7XHJcbiAgICAgICAgLy9jYWxjdWxhdGUgdGhlIG5ldyBtaW4taGVpZ2h0L3dpZHRoIGZvciB0aGUgZmlsbCBiYXIuIFVzZSBpc05hTiB0byBwcmV2ZW50IGZhbHNlIHBvc2l0aXZlcyBmb3IgbnVtYmVycyA8PSAwXHJcbiAgICAgICAgLy9iYXNlZCBvbiB0aGUgcGVyY2VudGFnZSBvZiBtb3ZlbWVudCBvZiB0aGUgaGFuZGxlIGJlaW5nIG1hbmlwdWxhdGVkLCBsZXNzIHRoZSBvcHBvc2luZyBoYW5kbGUncyBsZWZ0L3RvcCBwb3NpdGlvbiwgcGx1cyB0aGUgcGVyY2VudGFnZSB3L2ggb2YgdGhlIGhhbmRsZSBpdHNlbGZcclxuICAgICAgICBkaW0gPSBtb3ZlbWVudCAtIChpc05hTihoYW5kbGVQb3MpID8gKHRoaXMub3B0aW9ucy5pbml0aWFsU3RhcnQgLSB0aGlzLm9wdGlvbnMuc3RhcnQpLygodGhpcy5vcHRpb25zLmVuZC10aGlzLm9wdGlvbnMuc3RhcnQpLzEwMCkgOiBoYW5kbGVQb3MpICsgaGFuZGxlUGN0O1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGFzc2lnbiB0aGUgbWluLWhlaWdodC93aWR0aCB0byBvdXIgY3NzIG9iamVjdFxyXG4gICAgICBjc3NbYG1pbi0ke2hPcld9YF0gPSBgJHtkaW19JWA7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vbmUoJ2ZpbmlzaGVkLnpmLmFuaW1hdGUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBoYW5kbGUgaXMgZG9uZSBtb3ZpbmcuXHJcbiAgICAgICAgICAgICAgICAgICAgICogQGV2ZW50IFNsaWRlciNtb3ZlZFxyXG4gICAgICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLiRlbGVtZW50LnRyaWdnZXIoJ21vdmVkLnpmLnNsaWRlcicsIFskaG5kbF0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgLy9iZWNhdXNlIHdlIGRvbid0IGtub3cgZXhhY3RseSBob3cgdGhlIGhhbmRsZSB3aWxsIGJlIG1vdmVkLCBjaGVjayB0aGUgYW1vdW50IG9mIHRpbWUgaXQgc2hvdWxkIHRha2UgdG8gbW92ZS5cclxuICAgIHZhciBtb3ZlVGltZSA9IHRoaXMuJGVsZW1lbnQuZGF0YSgnZHJhZ2dpbmcnKSA/IDEwMDAvNjAgOiB0aGlzLm9wdGlvbnMubW92ZVRpbWU7XHJcblxyXG4gICAgRm91bmRhdGlvbi5Nb3ZlKG1vdmVUaW1lLCAkaG5kbCwgZnVuY3Rpb24oKSB7XHJcbiAgICAgIC8vIGFkanVzdGluZyB0aGUgbGVmdC90b3AgcHJvcGVydHkgb2YgdGhlIGhhbmRsZSwgYmFzZWQgb24gdGhlIHBlcmNlbnRhZ2UgY2FsY3VsYXRlZCBhYm92ZVxyXG4gICAgICAvLyBpZiBtb3ZlbWVudCBpc05hTiwgdGhhdCBpcyBiZWNhdXNlIHRoZSBzbGlkZXIgaXMgaGlkZGVuIGFuZCB3ZSBjYW5ub3QgZGV0ZXJtaW5lIGhhbmRsZSB3aWR0aCxcclxuICAgICAgLy8gZmFsbCBiYWNrIHRvIG5leHQgYmVzdCBndWVzcy5cclxuICAgICAgaWYgKGlzTmFOKG1vdmVtZW50KSkge1xyXG4gICAgICAgICRobmRsLmNzcyhsT3JULCBgJHtwY3RPZkJhciAqIDEwMH0lYCk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgJGhuZGwuY3NzKGxPclQsIGAke21vdmVtZW50fSVgKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCFfdGhpcy5vcHRpb25zLmRvdWJsZVNpZGVkKSB7XHJcbiAgICAgICAgLy9pZiBzaW5nbGUtaGFuZGxlZCwgYSBzaW1wbGUgbWV0aG9kIHRvIGV4cGFuZCB0aGUgZmlsbCBiYXJcclxuICAgICAgICBfdGhpcy4kZmlsbC5jc3MoaE9yVywgYCR7cGN0T2ZCYXIgKiAxMDB9JWApO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vb3RoZXJ3aXNlLCB1c2UgdGhlIGNzcyBvYmplY3Qgd2UgY3JlYXRlZCBhYm92ZVxyXG4gICAgICAgIF90aGlzLiRmaWxsLmNzcyhjc3MpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSB2YWx1ZSBoYXMgbm90IGJlZW4gY2hhbmdlIGZvciBhIGdpdmVuIHRpbWUuXHJcbiAgICAgKiBAZXZlbnQgU2xpZGVyI2NoYW5nZWRcclxuICAgICAqL1xyXG4gICAgY2xlYXJUaW1lb3V0KF90aGlzLnRpbWVvdXQpO1xyXG4gICAgX3RoaXMudGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgX3RoaXMuJGVsZW1lbnQudHJpZ2dlcignY2hhbmdlZC56Zi5zbGlkZXInLCBbJGhuZGxdKTtcclxuICAgIH0sIF90aGlzLm9wdGlvbnMuY2hhbmdlZERlbGF5KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGluaXRpYWwgYXR0cmlidXRlIGZvciB0aGUgc2xpZGVyIGVsZW1lbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge051bWJlcn0gaWR4IC0gaW5kZXggb2YgdGhlIGN1cnJlbnQgaGFuZGxlL2lucHV0IHRvIHVzZS5cclxuICAgKi9cclxuICBfc2V0SW5pdEF0dHIoaWR4KSB7XHJcbiAgICB2YXIgaW5pdFZhbCA9IChpZHggPT09IDAgPyB0aGlzLm9wdGlvbnMuaW5pdGlhbFN0YXJ0IDogdGhpcy5vcHRpb25zLmluaXRpYWxFbmQpXHJcbiAgICB2YXIgaWQgPSB0aGlzLmlucHV0cy5lcShpZHgpLmF0dHIoJ2lkJykgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnc2xpZGVyJyk7XHJcbiAgICB0aGlzLmlucHV0cy5lcShpZHgpLmF0dHIoe1xyXG4gICAgICAnaWQnOiBpZCxcclxuICAgICAgJ21heCc6IHRoaXMub3B0aW9ucy5lbmQsXHJcbiAgICAgICdtaW4nOiB0aGlzLm9wdGlvbnMuc3RhcnQsXHJcbiAgICAgICdzdGVwJzogdGhpcy5vcHRpb25zLnN0ZXBcclxuICAgIH0pO1xyXG4gICAgdGhpcy5pbnB1dHMuZXEoaWR4KS52YWwoaW5pdFZhbCk7XHJcbiAgICB0aGlzLmhhbmRsZXMuZXEoaWR4KS5hdHRyKHtcclxuICAgICAgJ3JvbGUnOiAnc2xpZGVyJyxcclxuICAgICAgJ2FyaWEtY29udHJvbHMnOiBpZCxcclxuICAgICAgJ2FyaWEtdmFsdWVtYXgnOiB0aGlzLm9wdGlvbnMuZW5kLFxyXG4gICAgICAnYXJpYS12YWx1ZW1pbic6IHRoaXMub3B0aW9ucy5zdGFydCxcclxuICAgICAgJ2FyaWEtdmFsdWVub3cnOiBpbml0VmFsLFxyXG4gICAgICAnYXJpYS1vcmllbnRhdGlvbic6IHRoaXMub3B0aW9ucy52ZXJ0aWNhbCA/ICd2ZXJ0aWNhbCcgOiAnaG9yaXpvbnRhbCcsXHJcbiAgICAgICd0YWJpbmRleCc6IDBcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgaW5wdXQgYW5kIGBhcmlhLXZhbHVlbm93YCB2YWx1ZXMgZm9yIHRoZSBzbGlkZXIgZWxlbWVudC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkaGFuZGxlIC0gdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBoYW5kbGUuXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbCAtIGZsb2F0aW5nIHBvaW50IG9mIHRoZSBuZXcgdmFsdWUuXHJcbiAgICovXHJcbiAgX3NldFZhbHVlcygkaGFuZGxlLCB2YWwpIHtcclxuICAgIHZhciBpZHggPSB0aGlzLm9wdGlvbnMuZG91YmxlU2lkZWQgPyB0aGlzLmhhbmRsZXMuaW5kZXgoJGhhbmRsZSkgOiAwO1xyXG4gICAgdGhpcy5pbnB1dHMuZXEoaWR4KS52YWwodmFsKTtcclxuICAgICRoYW5kbGUuYXR0cignYXJpYS12YWx1ZW5vdycsIHZhbCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGVzIGV2ZW50cyBvbiB0aGUgc2xpZGVyIGVsZW1lbnQuXHJcbiAgICogQ2FsY3VsYXRlcyB0aGUgbmV3IGxvY2F0aW9uIG9mIHRoZSBjdXJyZW50IGhhbmRsZS5cclxuICAgKiBJZiB0aGVyZSBhcmUgdHdvIGhhbmRsZXMgYW5kIHRoZSBiYXIgd2FzIGNsaWNrZWQsIGl0IGRldGVybWluZXMgd2hpY2ggaGFuZGxlIHRvIG1vdmUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZSAtIHRoZSBgZXZlbnRgIG9iamVjdCBwYXNzZWQgZnJvbSB0aGUgbGlzdGVuZXIuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRoYW5kbGUgLSB0aGUgY3VycmVudCBoYW5kbGUgdG8gY2FsY3VsYXRlIGZvciwgaWYgc2VsZWN0ZWQuXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbCAtIGZsb2F0aW5nIHBvaW50IG51bWJlciBmb3IgdGhlIG5ldyB2YWx1ZSBvZiB0aGUgc2xpZGVyLlxyXG4gICAqIFRPRE8gY2xlYW4gdGhpcyB1cCwgdGhlcmUncyBhIGxvdCBvZiByZXBlYXRlZCBjb2RlIGJldHdlZW4gdGhpcyBhbmQgdGhlIF9zZXRIYW5kbGVQb3MgZm4uXHJcbiAgICovXHJcbiAgX2hhbmRsZUV2ZW50KGUsICRoYW5kbGUsIHZhbCkge1xyXG4gICAgdmFyIHZhbHVlLCBoYXNWYWw7XHJcbiAgICBpZiAoIXZhbCkgey8vY2xpY2sgb3IgZHJhZyBldmVudHNcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgICAgdmVydGljYWwgPSB0aGlzLm9wdGlvbnMudmVydGljYWwsXHJcbiAgICAgICAgICBwYXJhbSA9IHZlcnRpY2FsID8gJ2hlaWdodCcgOiAnd2lkdGgnLFxyXG4gICAgICAgICAgZGlyZWN0aW9uID0gdmVydGljYWwgPyAndG9wJyA6ICdsZWZ0JyxcclxuICAgICAgICAgIGV2ZW50T2Zmc2V0ID0gdmVydGljYWwgPyBlLnBhZ2VZIDogZS5wYWdlWCxcclxuICAgICAgICAgIGhhbGZPZkhhbmRsZSA9IHRoaXMuJGhhbmRsZVswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVtwYXJhbV0gLyAyLFxyXG4gICAgICAgICAgYmFyRGltID0gdGhpcy4kZWxlbWVudFswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVtwYXJhbV0sXHJcbiAgICAgICAgICB3aW5kb3dTY3JvbGwgPSB2ZXJ0aWNhbCA/ICQod2luZG93KS5zY3JvbGxUb3AoKSA6ICQod2luZG93KS5zY3JvbGxMZWZ0KCk7XHJcblxyXG5cclxuICAgICAgdmFyIGVsZW1PZmZzZXQgPSB0aGlzLiRlbGVtZW50Lm9mZnNldCgpW2RpcmVjdGlvbl07XHJcblxyXG4gICAgICAvLyB0b3VjaCBldmVudHMgZW11bGF0ZWQgYnkgdGhlIHRvdWNoIHV0aWwgZ2l2ZSBwb3NpdGlvbiByZWxhdGl2ZSB0byBzY3JlZW4sIGFkZCB3aW5kb3cuc2Nyb2xsIHRvIGV2ZW50IGNvb3JkaW5hdGVzLi4uXHJcbiAgICAgIC8vIGJlc3Qgd2F5IHRvIGd1ZXNzIHRoaXMgaXMgc2ltdWxhdGVkIGlzIGlmIGNsaWVudFkgPT0gcGFnZVlcclxuICAgICAgaWYgKGUuY2xpZW50WSA9PT0gZS5wYWdlWSkgeyBldmVudE9mZnNldCA9IGV2ZW50T2Zmc2V0ICsgd2luZG93U2Nyb2xsOyB9XHJcbiAgICAgIHZhciBldmVudEZyb21CYXIgPSBldmVudE9mZnNldCAtIGVsZW1PZmZzZXQ7XHJcbiAgICAgIHZhciBiYXJYWTtcclxuICAgICAgaWYgKGV2ZW50RnJvbUJhciA8IDApIHtcclxuICAgICAgICBiYXJYWSA9IDA7XHJcbiAgICAgIH0gZWxzZSBpZiAoZXZlbnRGcm9tQmFyID4gYmFyRGltKSB7XHJcbiAgICAgICAgYmFyWFkgPSBiYXJEaW07XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYmFyWFkgPSBldmVudEZyb21CYXI7XHJcbiAgICAgIH1cclxuICAgICAgdmFyIG9mZnNldFBjdCA9IHBlcmNlbnQoYmFyWFksIGJhckRpbSk7XHJcblxyXG4gICAgICB2YWx1ZSA9IHRoaXMuX3ZhbHVlKG9mZnNldFBjdCk7XHJcblxyXG4gICAgICAvLyB0dXJuIGV2ZXJ5dGhpbmcgYXJvdW5kIGZvciBSVEwsIHlheSBtYXRoIVxyXG4gICAgICBpZiAoRm91bmRhdGlvbi5ydGwoKSAmJiAhdGhpcy5vcHRpb25zLnZlcnRpY2FsKSB7dmFsdWUgPSB0aGlzLm9wdGlvbnMuZW5kIC0gdmFsdWU7fVxyXG5cclxuICAgICAgdmFsdWUgPSBfdGhpcy5fYWRqdXN0VmFsdWUobnVsbCwgdmFsdWUpO1xyXG4gICAgICAvL2Jvb2xlYW4gZmxhZyBmb3IgdGhlIHNldEhhbmRsZVBvcyBmbiwgc3BlY2lmaWNhbGx5IGZvciB2ZXJ0aWNhbCBzbGlkZXJzXHJcbiAgICAgIGhhc1ZhbCA9IGZhbHNlO1xyXG5cclxuICAgICAgaWYgKCEkaGFuZGxlKSB7Ly9maWd1cmUgb3V0IHdoaWNoIGhhbmRsZSBpdCBpcywgcGFzcyBpdCB0byB0aGUgbmV4dCBmdW5jdGlvbi5cclxuICAgICAgICB2YXIgZmlyc3RIbmRsUG9zID0gYWJzUG9zaXRpb24odGhpcy4kaGFuZGxlLCBkaXJlY3Rpb24sIGJhclhZLCBwYXJhbSksXHJcbiAgICAgICAgICAgIHNlY25kSG5kbFBvcyA9IGFic1Bvc2l0aW9uKHRoaXMuJGhhbmRsZTIsIGRpcmVjdGlvbiwgYmFyWFksIHBhcmFtKTtcclxuICAgICAgICAgICAgJGhhbmRsZSA9IGZpcnN0SG5kbFBvcyA8PSBzZWNuZEhuZGxQb3MgPyB0aGlzLiRoYW5kbGUgOiB0aGlzLiRoYW5kbGUyO1xyXG4gICAgICB9XHJcblxyXG4gICAgfSBlbHNlIHsvL2NoYW5nZSBldmVudCBvbiBpbnB1dFxyXG4gICAgICB2YWx1ZSA9IHRoaXMuX2FkanVzdFZhbHVlKG51bGwsIHZhbCk7XHJcbiAgICAgIGhhc1ZhbCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fc2V0SGFuZGxlUG9zKCRoYW5kbGUsIHZhbHVlLCBoYXNWYWwpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRqdXN0ZXMgdmFsdWUgZm9yIGhhbmRsZSBpbiByZWdhcmQgdG8gc3RlcCB2YWx1ZS4gcmV0dXJucyBhZGp1c3RlZCB2YWx1ZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRoYW5kbGUgLSB0aGUgc2VsZWN0ZWQgaGFuZGxlLlxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtIHZhbHVlIHRvIGFkanVzdC4gdXNlZCBpZiAkaGFuZGxlIGlzIGZhbHN5XHJcbiAgICovXHJcbiAgX2FkanVzdFZhbHVlKCRoYW5kbGUsIHZhbHVlKSB7XHJcbiAgICB2YXIgdmFsLFxyXG4gICAgICBzdGVwID0gdGhpcy5vcHRpb25zLnN0ZXAsXHJcbiAgICAgIGRpdiA9IHBhcnNlRmxvYXQoc3RlcC8yKSxcclxuICAgICAgbGVmdCwgcHJldl92YWwsIG5leHRfdmFsO1xyXG4gICAgaWYgKCEhJGhhbmRsZSkge1xyXG4gICAgICB2YWwgPSBwYXJzZUZsb2F0KCRoYW5kbGUuYXR0cignYXJpYS12YWx1ZW5vdycpKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICB2YWwgPSB2YWx1ZTtcclxuICAgIH1cclxuICAgIGxlZnQgPSB2YWwgJSBzdGVwO1xyXG4gICAgcHJldl92YWwgPSB2YWwgLSBsZWZ0O1xyXG4gICAgbmV4dF92YWwgPSBwcmV2X3ZhbCArIHN0ZXA7XHJcbiAgICBpZiAobGVmdCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gdmFsO1xyXG4gICAgfVxyXG4gICAgdmFsID0gdmFsID49IHByZXZfdmFsICsgZGl2ID8gbmV4dF92YWwgOiBwcmV2X3ZhbDtcclxuICAgIHJldHVybiB2YWw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGxpc3RlbmVycyB0byB0aGUgc2xpZGVyIGVsZW1lbnRzLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHRoaXMuX2V2ZW50c0ZvckhhbmRsZSh0aGlzLiRoYW5kbGUpO1xyXG4gICAgaWYodGhpcy5oYW5kbGVzWzFdKSB7XHJcbiAgICAgIHRoaXMuX2V2ZW50c0ZvckhhbmRsZSh0aGlzLiRoYW5kbGUyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGxpc3RlbmVycyBhIHBhcnRpY3VsYXIgaGFuZGxlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGhhbmRsZSAtIHRoZSBjdXJyZW50IGhhbmRsZSB0byBhcHBseSBsaXN0ZW5lcnMgdG8uXHJcbiAgICovXHJcbiAgX2V2ZW50c0ZvckhhbmRsZSgkaGFuZGxlKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIGN1ckhhbmRsZSxcclxuICAgICAgICB0aW1lcjtcclxuXHJcbiAgICAgIHRoaXMuaW5wdXRzLm9mZignY2hhbmdlLnpmLnNsaWRlcicpLm9uKCdjaGFuZ2UuemYuc2xpZGVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciBpZHggPSBfdGhpcy5pbnB1dHMuaW5kZXgoJCh0aGlzKSk7XHJcbiAgICAgICAgX3RoaXMuX2hhbmRsZUV2ZW50KGUsIF90aGlzLmhhbmRsZXMuZXEoaWR4KSwgJCh0aGlzKS52YWwoKSk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5jbGlja1NlbGVjdCkge1xyXG4gICAgICAgIHRoaXMuJGVsZW1lbnQub2ZmKCdjbGljay56Zi5zbGlkZXInKS5vbignY2xpY2suemYuc2xpZGVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgaWYgKF90aGlzLiRlbGVtZW50LmRhdGEoJ2RyYWdnaW5nJykpIHsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG4gICAgICAgICAgaWYgKCEkKGUudGFyZ2V0KS5pcygnW2RhdGEtc2xpZGVyLWhhbmRsZV0nKSkge1xyXG4gICAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5kb3VibGVTaWRlZCkge1xyXG4gICAgICAgICAgICAgIF90aGlzLl9oYW5kbGVFdmVudChlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBfdGhpcy5faGFuZGxlRXZlbnQoZSwgX3RoaXMuJGhhbmRsZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlKSB7XHJcbiAgICAgIHRoaXMuaGFuZGxlcy5hZGRUb3VjaCgpO1xyXG5cclxuICAgICAgdmFyICRib2R5ID0gJCgnYm9keScpO1xyXG4gICAgICAkaGFuZGxlXHJcbiAgICAgICAgLm9mZignbW91c2Vkb3duLnpmLnNsaWRlcicpXHJcbiAgICAgICAgLm9uKCdtb3VzZWRvd24uemYuc2xpZGVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgJGhhbmRsZS5hZGRDbGFzcygnaXMtZHJhZ2dpbmcnKTtcclxuICAgICAgICAgIF90aGlzLiRmaWxsLmFkZENsYXNzKCdpcy1kcmFnZ2luZycpOy8vXHJcbiAgICAgICAgICBfdGhpcy4kZWxlbWVudC5kYXRhKCdkcmFnZ2luZycsIHRydWUpO1xyXG5cclxuICAgICAgICAgIGN1ckhhbmRsZSA9ICQoZS5jdXJyZW50VGFyZ2V0KTtcclxuXHJcbiAgICAgICAgICAkYm9keS5vbignbW91c2Vtb3ZlLnpmLnNsaWRlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBfdGhpcy5faGFuZGxlRXZlbnQoZSwgY3VySGFuZGxlKTtcclxuXHJcbiAgICAgICAgICB9KS5vbignbW91c2V1cC56Zi5zbGlkZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIF90aGlzLl9oYW5kbGVFdmVudChlLCBjdXJIYW5kbGUpO1xyXG5cclxuICAgICAgICAgICAgJGhhbmRsZS5yZW1vdmVDbGFzcygnaXMtZHJhZ2dpbmcnKTtcclxuICAgICAgICAgICAgX3RoaXMuJGZpbGwucmVtb3ZlQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7XHJcbiAgICAgICAgICAgIF90aGlzLiRlbGVtZW50LmRhdGEoJ2RyYWdnaW5nJywgZmFsc2UpO1xyXG5cclxuICAgICAgICAgICAgJGJvZHkub2ZmKCdtb3VzZW1vdmUuemYuc2xpZGVyIG1vdXNldXAuemYuc2xpZGVyJyk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSlcclxuICAgICAgLy8gcHJldmVudCBldmVudHMgdHJpZ2dlcmVkIGJ5IHRvdWNoXHJcbiAgICAgIC5vbignc2VsZWN0c3RhcnQuemYuc2xpZGVyIHRvdWNobW92ZS56Zi5zbGlkZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAkaGFuZGxlLm9mZigna2V5ZG93bi56Zi5zbGlkZXInKS5vbigna2V5ZG93bi56Zi5zbGlkZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIHZhciBfJGhhbmRsZSA9ICQodGhpcyksXHJcbiAgICAgICAgICBpZHggPSBfdGhpcy5vcHRpb25zLmRvdWJsZVNpZGVkID8gX3RoaXMuaGFuZGxlcy5pbmRleChfJGhhbmRsZSkgOiAwLFxyXG4gICAgICAgICAgb2xkVmFsdWUgPSBwYXJzZUZsb2F0KF90aGlzLmlucHV0cy5lcShpZHgpLnZhbCgpKSxcclxuICAgICAgICAgIG5ld1ZhbHVlO1xyXG5cclxuICAgICAgLy8gaGFuZGxlIGtleWJvYXJkIGV2ZW50IHdpdGgga2V5Ym9hcmQgdXRpbFxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnU2xpZGVyJywge1xyXG4gICAgICAgIGRlY3JlYXNlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIG5ld1ZhbHVlID0gb2xkVmFsdWUgLSBfdGhpcy5vcHRpb25zLnN0ZXA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpbmNyZWFzZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBuZXdWYWx1ZSA9IG9sZFZhbHVlICsgX3RoaXMub3B0aW9ucy5zdGVwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZGVjcmVhc2VfZmFzdDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBuZXdWYWx1ZSA9IG9sZFZhbHVlIC0gX3RoaXMub3B0aW9ucy5zdGVwICogMTA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpbmNyZWFzZV9mYXN0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIG5ld1ZhbHVlID0gb2xkVmFsdWUgKyBfdGhpcy5vcHRpb25zLnN0ZXAgKiAxMDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKCkgeyAvLyBvbmx5IHNldCBoYW5kbGUgcG9zIHdoZW4gZXZlbnQgd2FzIGhhbmRsZWQgc3BlY2lhbGx5XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBfdGhpcy5fc2V0SGFuZGxlUG9zKF8kaGFuZGxlLCBuZXdWYWx1ZSwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgLyppZiAobmV3VmFsdWUpIHsgLy8gaWYgcHJlc3NlZCBrZXkgaGFzIHNwZWNpYWwgZnVuY3Rpb24sIHVwZGF0ZSB2YWx1ZVxyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBfdGhpcy5fc2V0SGFuZGxlUG9zKF8kaGFuZGxlLCBuZXdWYWx1ZSk7XHJcbiAgICAgIH0qL1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgc2xpZGVyIHBsdWdpbi5cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy5oYW5kbGVzLm9mZignLnpmLnNsaWRlcicpO1xyXG4gICAgdGhpcy5pbnB1dHMub2ZmKCcuemYuc2xpZGVyJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnNsaWRlcicpO1xyXG5cclxuICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcblNsaWRlci5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBNaW5pbXVtIHZhbHVlIGZvciB0aGUgc2xpZGVyIHNjYWxlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAwXHJcbiAgICovXHJcbiAgc3RhcnQ6IDAsXHJcbiAgLyoqXHJcbiAgICogTWF4aW11bSB2YWx1ZSBmb3IgdGhlIHNsaWRlciBzY2FsZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTAwXHJcbiAgICovXHJcbiAgZW5kOiAxMDAsXHJcbiAgLyoqXHJcbiAgICogTWluaW11bSB2YWx1ZSBjaGFuZ2UgcGVyIGNoYW5nZSBldmVudC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMVxyXG4gICAqL1xyXG4gIHN0ZXA6IDEsXHJcbiAgLyoqXHJcbiAgICogVmFsdWUgYXQgd2hpY2ggdGhlIGhhbmRsZS9pbnB1dCAqKGxlZnQgaGFuZGxlL2ZpcnN0IGlucHV0KSogc2hvdWxkIGJlIHNldCB0byBvbiBpbml0aWFsaXphdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMFxyXG4gICAqL1xyXG4gIGluaXRpYWxTdGFydDogMCxcclxuICAvKipcclxuICAgKiBWYWx1ZSBhdCB3aGljaCB0aGUgcmlnaHQgaGFuZGxlL3NlY29uZCBpbnB1dCBzaG91bGQgYmUgc2V0IHRvIG9uIGluaXRpYWxpemF0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMDBcclxuICAgKi9cclxuICBpbml0aWFsRW5kOiAxMDAsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBpbnB1dCB0byBiZSBsb2NhdGVkIG91dHNpZGUgdGhlIGNvbnRhaW5lciBhbmQgdmlzaWJsZS4gU2V0IHRvIGJ5IHRoZSBKU1xyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGJpbmRpbmc6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgdXNlciB0byBjbGljay90YXAgb24gdGhlIHNsaWRlciBiYXIgdG8gc2VsZWN0IGEgdmFsdWUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbGlja1NlbGVjdDogdHJ1ZSxcclxuICAvKipcclxuICAgKiBTZXQgdG8gdHJ1ZSBhbmQgdXNlIHRoZSBgdmVydGljYWxgIGNsYXNzIHRvIGNoYW5nZSBhbGlnbm1lbnQgdG8gdmVydGljYWwuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgdmVydGljYWw6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgdXNlciB0byBkcmFnIHRoZSBzbGlkZXIgaGFuZGxlKHMpIHRvIHNlbGVjdCBhIHZhbHVlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgZHJhZ2dhYmxlOiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIERpc2FibGVzIHRoZSBzbGlkZXIgYW5kIHByZXZlbnRzIGV2ZW50IGxpc3RlbmVycyBmcm9tIGJlaW5nIGFwcGxpZWQuIERvdWJsZSBjaGVja2VkIGJ5IEpTIHdpdGggYGRpc2FibGVkQ2xhc3NgLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGRpc2FibGVkOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHVzZSBvZiB0d28gaGFuZGxlcy4gRG91YmxlIGNoZWNrZWQgYnkgdGhlIEpTLiBDaGFuZ2VzIHNvbWUgbG9naWMgaGFuZGxpbmcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZG91YmxlU2lkZWQ6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIFBvdGVudGlhbCBmdXR1cmUgZmVhdHVyZS5cclxuICAgKi9cclxuICAvLyBzdGVwczogMTAwLFxyXG4gIC8qKlxyXG4gICAqIE51bWJlciBvZiBkZWNpbWFsIHBsYWNlcyB0aGUgcGx1Z2luIHNob3VsZCBnbyB0byBmb3IgZmxvYXRpbmcgcG9pbnQgcHJlY2lzaW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAyXHJcbiAgICovXHJcbiAgZGVjaW1hbDogMixcclxuICAvKipcclxuICAgKiBUaW1lIGRlbGF5IGZvciBkcmFnZ2VkIGVsZW1lbnRzLlxyXG4gICAqL1xyXG4gIC8vIGRyYWdEZWxheTogMCxcclxuICAvKipcclxuICAgKiBUaW1lLCBpbiBtcywgdG8gYW5pbWF0ZSB0aGUgbW92ZW1lbnQgb2YgYSBzbGlkZXIgaGFuZGxlIGlmIHVzZXIgY2xpY2tzL3RhcHMgb24gdGhlIGJhci4gTmVlZHMgdG8gYmUgbWFudWFsbHkgc2V0IGlmIHVwZGF0aW5nIHRoZSB0cmFuc2l0aW9uIHRpbWUgaW4gdGhlIFNhc3Mgc2V0dGluZ3MuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDIwMFxyXG4gICAqL1xyXG4gIG1vdmVUaW1lOiAyMDAsLy91cGRhdGUgdGhpcyBpZiBjaGFuZ2luZyB0aGUgdHJhbnNpdGlvbiB0aW1lIGluIHRoZSBzYXNzXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byBkaXNhYmxlZCBzbGlkZXJzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnZGlzYWJsZWQnXHJcbiAgICovXHJcbiAgZGlzYWJsZWRDbGFzczogJ2Rpc2FibGVkJyxcclxuICAvKipcclxuICAgKiBXaWxsIGludmVydCB0aGUgZGVmYXVsdCBsYXlvdXQgZm9yIGEgdmVydGljYWw8c3BhbiBkYXRhLXRvb2x0aXAgdGl0bGU9XCJ3aG8gd291bGQgZG8gdGhpcz8/P1wiPiA8L3NwYW4+c2xpZGVyLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGludmVydFZlcnRpY2FsOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBNaWxsaXNlY29uZHMgYmVmb3JlIHRoZSBgY2hhbmdlZC56Zi1zbGlkZXJgIGV2ZW50IGlzIHRyaWdnZXJlZCBhZnRlciB2YWx1ZSBjaGFuZ2UuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwMFxyXG4gICAqL1xyXG4gIGNoYW5nZWREZWxheTogNTAwLFxyXG4gIC8qKlxyXG4gICogQmFzZXZhbHVlIGZvciBub24tbGluZWFyIHNsaWRlcnNcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIDVcclxuICAqL1xyXG4gIG5vbkxpbmVhckJhc2U6IDUsXHJcbiAgLyoqXHJcbiAgKiBCYXNldmFsdWUgZm9yIG5vbi1saW5lYXIgc2xpZGVycywgcG9zc2libGUgdmFsdWVzIGFyZTogJ2xpbmVhcicsICdwb3cnICYgJ2xvZycuIFBvdyBhbmQgTG9nIHVzZSB0aGUgbm9uTGluZWFyQmFzZSBzZXR0aW5nLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ2xpbmVhcidcclxuICAqL1xyXG4gIHBvc2l0aW9uVmFsdWVGdW5jdGlvbjogJ2xpbmVhcicsXHJcbn07XHJcblxyXG5mdW5jdGlvbiBwZXJjZW50KGZyYWMsIG51bSkge1xyXG4gIHJldHVybiAoZnJhYyAvIG51bSk7XHJcbn1cclxuZnVuY3Rpb24gYWJzUG9zaXRpb24oJGhhbmRsZSwgZGlyLCBjbGlja1BvcywgcGFyYW0pIHtcclxuICByZXR1cm4gTWF0aC5hYnMoKCRoYW5kbGUucG9zaXRpb24oKVtkaXJdICsgKCRoYW5kbGVbcGFyYW1dKCkgLyAyKSkgLSBjbGlja1Bvcyk7XHJcbn1cclxuZnVuY3Rpb24gYmFzZUxvZyhiYXNlLCB2YWx1ZSkge1xyXG4gIHJldHVybiBNYXRoLmxvZyh2YWx1ZSkvTWF0aC5sb2coYmFzZSlcclxufVxyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oU2xpZGVyLCAnU2xpZGVyJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcblxyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFN0aWNreSBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5zdGlja3lcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICovXHJcblxyXG5jbGFzcyBTdGlja3kge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYSBzdGlja3kgdGhpbmcuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2Ugc3RpY2t5LlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gb3B0aW9ucyBvYmplY3QgcGFzc2VkIHdoZW4gY3JlYXRpbmcgdGhlIGVsZW1lbnQgcHJvZ3JhbW1hdGljYWxseS5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBTdGlja3kuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnU3RpY2t5Jyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgc3RpY2t5IGVsZW1lbnQgYnkgYWRkaW5nIGNsYXNzZXMsIGdldHRpbmcvc2V0dGluZyBkaW1lbnNpb25zLCBicmVha3BvaW50cyBhbmQgYXR0cmlidXRlc1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgJHBhcmVudCA9IHRoaXMuJGVsZW1lbnQucGFyZW50KCdbZGF0YS1zdGlja3ktY29udGFpbmVyXScpLFxyXG4gICAgICAgIGlkID0gdGhpcy4kZWxlbWVudFswXS5pZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdzdGlja3knKSxcclxuICAgICAgICBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgaWYgKCEkcGFyZW50Lmxlbmd0aCkge1xyXG4gICAgICB0aGlzLndhc1dyYXBwZWQgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdGhpcy4kY29udGFpbmVyID0gJHBhcmVudC5sZW5ndGggPyAkcGFyZW50IDogJCh0aGlzLm9wdGlvbnMuY29udGFpbmVyKS53cmFwSW5uZXIodGhpcy4kZWxlbWVudCk7XHJcbiAgICB0aGlzLiRjb250YWluZXIuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmNvbnRhaW5lckNsYXNzKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKHRoaXMub3B0aW9ucy5zdGlja3lDbGFzcylcclxuICAgICAgICAgICAgICAgICAuYXR0cih7J2RhdGEtcmVzaXplJzogaWR9KTtcclxuXHJcbiAgICB0aGlzLnNjcm9sbENvdW50ID0gdGhpcy5vcHRpb25zLmNoZWNrRXZlcnk7XHJcbiAgICB0aGlzLmlzU3R1Y2sgPSBmYWxzZTtcclxuICAgICQod2luZG93KS5vbmUoJ2xvYWQuemYuc3RpY2t5JywgZnVuY3Rpb24oKXtcclxuICAgICAgLy9XZSBjYWxjdWxhdGUgdGhlIGNvbnRhaW5lciBoZWlnaHQgdG8gaGF2ZSBjb3JyZWN0IHZhbHVlcyBmb3IgYW5jaG9yIHBvaW50cyBvZmZzZXQgY2FsY3VsYXRpb24uXHJcbiAgICAgIF90aGlzLmNvbnRhaW5lckhlaWdodCA9IF90aGlzLiRlbGVtZW50LmNzcyhcImRpc3BsYXlcIikgPT0gXCJub25lXCIgPyAwIDogX3RoaXMuJGVsZW1lbnRbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xyXG4gICAgICBfdGhpcy4kY29udGFpbmVyLmNzcygnaGVpZ2h0JywgX3RoaXMuY29udGFpbmVySGVpZ2h0KTtcclxuICAgICAgX3RoaXMuZWxlbUhlaWdodCA9IF90aGlzLmNvbnRhaW5lckhlaWdodDtcclxuICAgICAgaWYoX3RoaXMub3B0aW9ucy5hbmNob3IgIT09ICcnKXtcclxuICAgICAgICBfdGhpcy4kYW5jaG9yID0gJCgnIycgKyBfdGhpcy5vcHRpb25zLmFuY2hvcik7XHJcbiAgICAgIH1lbHNle1xyXG4gICAgICAgIF90aGlzLl9wYXJzZVBvaW50cygpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBfdGhpcy5fc2V0U2l6ZXMoZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgc2Nyb2xsID0gd2luZG93LnBhZ2VZT2Zmc2V0O1xyXG4gICAgICAgIF90aGlzLl9jYWxjKGZhbHNlLCBzY3JvbGwpO1xyXG4gICAgICAgIC8vVW5zdGljayB0aGUgZWxlbWVudCB3aWxsIGVuc3VyZSB0aGF0IHByb3BlciBjbGFzc2VzIGFyZSBzZXQuXHJcbiAgICAgICAgaWYgKCFfdGhpcy5pc1N0dWNrKSB7XHJcbiAgICAgICAgICBfdGhpcy5fcmVtb3ZlU3RpY2t5KChzY3JvbGwgPj0gX3RoaXMudG9wUG9pbnQpID8gZmFsc2UgOiB0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICBfdGhpcy5fZXZlbnRzKGlkLnNwbGl0KCctJykucmV2ZXJzZSgpLmpvaW4oJy0nKSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIElmIHVzaW5nIG11bHRpcGxlIGVsZW1lbnRzIGFzIGFuY2hvcnMsIGNhbGN1bGF0ZXMgdGhlIHRvcCBhbmQgYm90dG9tIHBpeGVsIHZhbHVlcyB0aGUgc3RpY2t5IHRoaW5nIHNob3VsZCBzdGljayBhbmQgdW5zdGljayBvbi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9wYXJzZVBvaW50cygpIHtcclxuICAgIHZhciB0b3AgPSB0aGlzLm9wdGlvbnMudG9wQW5jaG9yID09IFwiXCIgPyAxIDogdGhpcy5vcHRpb25zLnRvcEFuY2hvcixcclxuICAgICAgICBidG0gPSB0aGlzLm9wdGlvbnMuYnRtQW5jaG9yPT0gXCJcIiA/IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxIZWlnaHQgOiB0aGlzLm9wdGlvbnMuYnRtQW5jaG9yLFxyXG4gICAgICAgIHB0cyA9IFt0b3AsIGJ0bV0sXHJcbiAgICAgICAgYnJlYWtzID0ge307XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcHRzLmxlbmd0aDsgaSA8IGxlbiAmJiBwdHNbaV07IGkrKykge1xyXG4gICAgICB2YXIgcHQ7XHJcbiAgICAgIGlmICh0eXBlb2YgcHRzW2ldID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgIHB0ID0gcHRzW2ldO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciBwbGFjZSA9IHB0c1tpXS5zcGxpdCgnOicpLFxyXG4gICAgICAgICAgICBhbmNob3IgPSAkKGAjJHtwbGFjZVswXX1gKTtcclxuXHJcbiAgICAgICAgcHQgPSBhbmNob3Iub2Zmc2V0KCkudG9wO1xyXG4gICAgICAgIGlmIChwbGFjZVsxXSAmJiBwbGFjZVsxXS50b0xvd2VyQ2FzZSgpID09PSAnYm90dG9tJykge1xyXG4gICAgICAgICAgcHQgKz0gYW5jaG9yWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgYnJlYWtzW2ldID0gcHQ7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHRoaXMucG9pbnRzID0gYnJlYWtzO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyBmb3IgdGhlIHNjcm9sbGluZyBlbGVtZW50LlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGlkIC0gcHN1ZWRvLXJhbmRvbSBpZCBmb3IgdW5pcXVlIHNjcm9sbCBldmVudCBsaXN0ZW5lci5cclxuICAgKi9cclxuICBfZXZlbnRzKGlkKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIHNjcm9sbExpc3RlbmVyID0gdGhpcy5zY3JvbGxMaXN0ZW5lciA9IGBzY3JvbGwuemYuJHtpZH1gO1xyXG4gICAgaWYgKHRoaXMuaXNPbikgeyByZXR1cm47IH1cclxuICAgIGlmICh0aGlzLmNhblN0aWNrKSB7XHJcbiAgICAgIHRoaXMuaXNPbiA9IHRydWU7XHJcbiAgICAgICQod2luZG93KS5vZmYoc2Nyb2xsTGlzdGVuZXIpXHJcbiAgICAgICAgICAgICAgIC5vbihzY3JvbGxMaXN0ZW5lciwgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICAgICAgIGlmIChfdGhpcy5zY3JvbGxDb3VudCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgX3RoaXMuc2Nyb2xsQ291bnQgPSBfdGhpcy5vcHRpb25zLmNoZWNrRXZlcnk7XHJcbiAgICAgICAgICAgICAgICAgICBfdGhpcy5fc2V0U2l6ZXMoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxjKGZhbHNlLCB3aW5kb3cucGFnZVlPZmZzZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgIF90aGlzLnNjcm9sbENvdW50LS07XHJcbiAgICAgICAgICAgICAgICAgICBfdGhpcy5fY2FsYyhmYWxzZSwgd2luZG93LnBhZ2VZT2Zmc2V0KTtcclxuICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInKVxyXG4gICAgICAgICAgICAgICAgIC5vbigncmVzaXplbWUuemYudHJpZ2dlcicsIGZ1bmN0aW9uKGUsIGVsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9zZXRTaXplcyhmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fY2FsYyhmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaWYgKF90aGlzLmNhblN0aWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIV90aGlzLmlzT24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2V2ZW50cyhpZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChfdGhpcy5pc09uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fcGF1c2VMaXN0ZW5lcnMoc2Nyb2xsTGlzdGVuZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMgZXZlbnQgaGFuZGxlcnMgZm9yIHNjcm9sbCBhbmQgY2hhbmdlIGV2ZW50cyBvbiBhbmNob3IuXHJcbiAgICogQGZpcmVzIFN0aWNreSNwYXVzZVxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzY3JvbGxMaXN0ZW5lciAtIHVuaXF1ZSwgbmFtZXNwYWNlZCBzY3JvbGwgbGlzdGVuZXIgYXR0YWNoZWQgdG8gYHdpbmRvd2BcclxuICAgKi9cclxuICBfcGF1c2VMaXN0ZW5lcnMoc2Nyb2xsTGlzdGVuZXIpIHtcclxuICAgIHRoaXMuaXNPbiA9IGZhbHNlO1xyXG4gICAgJCh3aW5kb3cpLm9mZihzY3JvbGxMaXN0ZW5lcik7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBwbHVnaW4gaXMgcGF1c2VkIGR1ZSB0byByZXNpemUgZXZlbnQgc2hyaW5raW5nIHRoZSB2aWV3LlxyXG4gICAgICogQGV2ZW50IFN0aWNreSNwYXVzZVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncGF1c2UuemYuc3RpY2t5Jyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxsZWQgb24gZXZlcnkgYHNjcm9sbGAgZXZlbnQgYW5kIG9uIGBfaW5pdGBcclxuICAgKiBmaXJlcyBmdW5jdGlvbnMgYmFzZWQgb24gYm9vbGVhbnMgYW5kIGNhY2hlZCB2YWx1ZXNcclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGNoZWNrU2l6ZXMgLSB0cnVlIGlmIHBsdWdpbiBzaG91bGQgcmVjYWxjdWxhdGUgc2l6ZXMgYW5kIGJyZWFrcG9pbnRzLlxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzY3JvbGwgLSBjdXJyZW50IHNjcm9sbCBwb3NpdGlvbiBwYXNzZWQgZnJvbSBzY3JvbGwgZXZlbnQgY2IgZnVuY3Rpb24uIElmIG5vdCBwYXNzZWQsIGRlZmF1bHRzIHRvIGB3aW5kb3cucGFnZVlPZmZzZXRgLlxyXG4gICAqL1xyXG4gIF9jYWxjKGNoZWNrU2l6ZXMsIHNjcm9sbCkge1xyXG4gICAgaWYgKGNoZWNrU2l6ZXMpIHsgdGhpcy5fc2V0U2l6ZXMoKTsgfVxyXG5cclxuICAgIGlmICghdGhpcy5jYW5TdGljaykge1xyXG4gICAgICBpZiAodGhpcy5pc1N0dWNrKSB7XHJcbiAgICAgICAgdGhpcy5fcmVtb3ZlU3RpY2t5KHRydWUpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXNjcm9sbCkgeyBzY3JvbGwgPSB3aW5kb3cucGFnZVlPZmZzZXQ7IH1cclxuXHJcbiAgICBpZiAoc2Nyb2xsID49IHRoaXMudG9wUG9pbnQpIHtcclxuICAgICAgaWYgKHNjcm9sbCA8PSB0aGlzLmJvdHRvbVBvaW50KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmlzU3R1Y2spIHtcclxuICAgICAgICAgIHRoaXMuX3NldFN0aWNreSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAodGhpcy5pc1N0dWNrKSB7XHJcbiAgICAgICAgICB0aGlzLl9yZW1vdmVTdGlja3koZmFsc2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKHRoaXMuaXNTdHVjaykge1xyXG4gICAgICAgIHRoaXMuX3JlbW92ZVN0aWNreSh0cnVlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2F1c2VzIHRoZSAkZWxlbWVudCB0byBiZWNvbWUgc3R1Y2suXHJcbiAgICogQWRkcyBgcG9zaXRpb246IGZpeGVkO2AsIGFuZCBoZWxwZXIgY2xhc3Nlcy5cclxuICAgKiBAZmlyZXMgU3RpY2t5I3N0dWNrdG9cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zZXRTdGlja3koKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIHN0aWNrVG8gPSB0aGlzLm9wdGlvbnMuc3RpY2tUbyxcclxuICAgICAgICBtcmduID0gc3RpY2tUbyA9PT0gJ3RvcCcgPyAnbWFyZ2luVG9wJyA6ICdtYXJnaW5Cb3R0b20nLFxyXG4gICAgICAgIG5vdFN0dWNrVG8gPSBzdGlja1RvID09PSAndG9wJyA/ICdib3R0b20nIDogJ3RvcCcsXHJcbiAgICAgICAgY3NzID0ge307XHJcblxyXG4gICAgY3NzW21yZ25dID0gYCR7dGhpcy5vcHRpb25zW21yZ25dfWVtYDtcclxuICAgIGNzc1tzdGlja1RvXSA9IDA7XHJcbiAgICBjc3Nbbm90U3R1Y2tUb10gPSAnYXV0byc7XHJcbiAgICB0aGlzLmlzU3R1Y2sgPSB0cnVlO1xyXG4gICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhgaXMtYW5jaG9yZWQgaXMtYXQtJHtub3RTdHVja1RvfWApXHJcbiAgICAgICAgICAgICAgICAgLmFkZENsYXNzKGBpcy1zdHVjayBpcy1hdC0ke3N0aWNrVG99YClcclxuICAgICAgICAgICAgICAgICAuY3NzKGNzcylcclxuICAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSAkZWxlbWVudCBoYXMgYmVjb21lIGBwb3NpdGlvbjogZml4ZWQ7YFxyXG4gICAgICAgICAgICAgICAgICAqIE5hbWVzcGFjZWQgdG8gYHRvcGAgb3IgYGJvdHRvbWAsIGUuZy4gYHN0aWNreS56Zi5zdHVja3RvOnRvcGBcclxuICAgICAgICAgICAgICAgICAgKiBAZXZlbnQgU3RpY2t5I3N0dWNrdG9cclxuICAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgICAudHJpZ2dlcihgc3RpY2t5LnpmLnN0dWNrdG86JHtzdGlja1RvfWApO1xyXG4gICAgdGhpcy4kZWxlbWVudC5vbihcInRyYW5zaXRpb25lbmQgd2Via2l0VHJhbnNpdGlvbkVuZCBvVHJhbnNpdGlvbkVuZCBvdHJhbnNpdGlvbmVuZCBNU1RyYW5zaXRpb25FbmRcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICAgIF90aGlzLl9zZXRTaXplcygpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYXVzZXMgdGhlICRlbGVtZW50IHRvIGJlY29tZSB1bnN0dWNrLlxyXG4gICAqIFJlbW92ZXMgYHBvc2l0aW9uOiBmaXhlZDtgLCBhbmQgaGVscGVyIGNsYXNzZXMuXHJcbiAgICogQWRkcyBvdGhlciBoZWxwZXIgY2xhc3Nlcy5cclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGlzVG9wIC0gdGVsbHMgdGhlIGZ1bmN0aW9uIGlmIHRoZSAkZWxlbWVudCBzaG91bGQgYW5jaG9yIHRvIHRoZSB0b3Agb3IgYm90dG9tIG9mIGl0cyAkYW5jaG9yIGVsZW1lbnQuXHJcbiAgICogQGZpcmVzIFN0aWNreSN1bnN0dWNrZnJvbVxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3JlbW92ZVN0aWNreShpc1RvcCkge1xyXG4gICAgdmFyIHN0aWNrVG8gPSB0aGlzLm9wdGlvbnMuc3RpY2tUbyxcclxuICAgICAgICBzdGlja1RvVG9wID0gc3RpY2tUbyA9PT0gJ3RvcCcsXHJcbiAgICAgICAgY3NzID0ge30sXHJcbiAgICAgICAgYW5jaG9yUHQgPSAodGhpcy5wb2ludHMgPyB0aGlzLnBvaW50c1sxXSAtIHRoaXMucG9pbnRzWzBdIDogdGhpcy5hbmNob3JIZWlnaHQpIC0gdGhpcy5lbGVtSGVpZ2h0LFxyXG4gICAgICAgIG1yZ24gPSBzdGlja1RvVG9wID8gJ21hcmdpblRvcCcgOiAnbWFyZ2luQm90dG9tJyxcclxuICAgICAgICBub3RTdHVja1RvID0gc3RpY2tUb1RvcCA/ICdib3R0b20nIDogJ3RvcCcsXHJcbiAgICAgICAgdG9wT3JCb3R0b20gPSBpc1RvcCA/ICd0b3AnIDogJ2JvdHRvbSc7XHJcblxyXG4gICAgY3NzW21yZ25dID0gMDtcclxuXHJcbiAgICBjc3NbJ2JvdHRvbSddID0gJ2F1dG8nO1xyXG4gICAgaWYoaXNUb3ApIHtcclxuICAgICAgY3NzWyd0b3AnXSA9IDA7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjc3NbJ3RvcCddID0gYW5jaG9yUHQ7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5pc1N0dWNrID0gZmFsc2U7XHJcbiAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKGBpcy1zdHVjayBpcy1hdC0ke3N0aWNrVG99YClcclxuICAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoYGlzLWFuY2hvcmVkIGlzLWF0LSR7dG9wT3JCb3R0b219YClcclxuICAgICAgICAgICAgICAgICAuY3NzKGNzcylcclxuICAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSAkZWxlbWVudCBoYXMgYmVjb21lIGFuY2hvcmVkLlxyXG4gICAgICAgICAgICAgICAgICAqIE5hbWVzcGFjZWQgdG8gYHRvcGAgb3IgYGJvdHRvbWAsIGUuZy4gYHN0aWNreS56Zi51bnN0dWNrZnJvbTpib3R0b21gXHJcbiAgICAgICAgICAgICAgICAgICogQGV2ZW50IFN0aWNreSN1bnN0dWNrZnJvbVxyXG4gICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgIC50cmlnZ2VyKGBzdGlja3kuemYudW5zdHVja2Zyb206JHt0b3BPckJvdHRvbX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlICRlbGVtZW50IGFuZCAkY29udGFpbmVyIHNpemVzIGZvciBwbHVnaW4uXHJcbiAgICogQ2FsbHMgYF9zZXRCcmVha1BvaW50c2AuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBvcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiB0byBmaXJlIG9uIGNvbXBsZXRpb24gb2YgYF9zZXRCcmVha1BvaW50c2AuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc2V0U2l6ZXMoY2IpIHtcclxuICAgIHRoaXMuY2FuU3RpY2sgPSBGb3VuZGF0aW9uLk1lZGlhUXVlcnkuaXModGhpcy5vcHRpb25zLnN0aWNreU9uKTtcclxuICAgIGlmICghdGhpcy5jYW5TdGljaykge1xyXG4gICAgICBpZiAoY2IgJiYgdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7IGNiKCk7IH1cclxuICAgIH1cclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgbmV3RWxlbVdpZHRoID0gdGhpcy4kY29udGFpbmVyWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoLFxyXG4gICAgICAgIGNvbXAgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLiRjb250YWluZXJbMF0pLFxyXG4gICAgICAgIHBkbmdsID0gcGFyc2VJbnQoY29tcFsncGFkZGluZy1sZWZ0J10sIDEwKSxcclxuICAgICAgICBwZG5nciA9IHBhcnNlSW50KGNvbXBbJ3BhZGRpbmctcmlnaHQnXSwgMTApO1xyXG5cclxuICAgIGlmICh0aGlzLiRhbmNob3IgJiYgdGhpcy4kYW5jaG9yLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLmFuY2hvckhlaWdodCA9IHRoaXMuJGFuY2hvclswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9wYXJzZVBvaW50cygpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuY3NzKHtcclxuICAgICAgJ21heC13aWR0aCc6IGAke25ld0VsZW1XaWR0aCAtIHBkbmdsIC0gcGRuZ3J9cHhgXHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgbmV3Q29udGFpbmVySGVpZ2h0ID0gdGhpcy4kZWxlbWVudFswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgfHwgdGhpcy5jb250YWluZXJIZWlnaHQ7XHJcbiAgICBpZiAodGhpcy4kZWxlbWVudC5jc3MoXCJkaXNwbGF5XCIpID09IFwibm9uZVwiKSB7XHJcbiAgICAgIG5ld0NvbnRhaW5lckhlaWdodCA9IDA7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNvbnRhaW5lckhlaWdodCA9IG5ld0NvbnRhaW5lckhlaWdodDtcclxuICAgIHRoaXMuJGNvbnRhaW5lci5jc3Moe1xyXG4gICAgICBoZWlnaHQ6IG5ld0NvbnRhaW5lckhlaWdodFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLmVsZW1IZWlnaHQgPSBuZXdDb250YWluZXJIZWlnaHQ7XHJcblxyXG4gICAgaWYgKCF0aGlzLmlzU3R1Y2spIHtcclxuICAgICAgaWYgKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2lzLWF0LWJvdHRvbScpKSB7XHJcbiAgICAgICAgdmFyIGFuY2hvclB0ID0gKHRoaXMucG9pbnRzID8gdGhpcy5wb2ludHNbMV0gLSB0aGlzLiRjb250YWluZXIub2Zmc2V0KCkudG9wIDogdGhpcy5hbmNob3JIZWlnaHQpIC0gdGhpcy5lbGVtSGVpZ2h0O1xyXG4gICAgICAgIHRoaXMuJGVsZW1lbnQuY3NzKCd0b3AnLCBhbmNob3JQdCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9zZXRCcmVha1BvaW50cyhuZXdDb250YWluZXJIZWlnaHQsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAoY2IgJiYgdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7IGNiKCk7IH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgdXBwZXIgYW5kIGxvd2VyIGJyZWFrcG9pbnRzIGZvciB0aGUgZWxlbWVudCB0byBiZWNvbWUgc3RpY2t5L3Vuc3RpY2t5LlxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBlbGVtSGVpZ2h0IC0gcHggdmFsdWUgZm9yIHN0aWNreS4kZWxlbWVudCBoZWlnaHQsIGNhbGN1bGF0ZWQgYnkgYF9zZXRTaXplc2AuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBvcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb24gY29tcGxldGlvbi5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zZXRCcmVha1BvaW50cyhlbGVtSGVpZ2h0LCBjYikge1xyXG4gICAgaWYgKCF0aGlzLmNhblN0aWNrKSB7XHJcbiAgICAgIGlmIChjYiAmJiB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHsgY2IoKTsgfVxyXG4gICAgICBlbHNlIHsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgICB9XHJcbiAgICB2YXIgbVRvcCA9IGVtQ2FsYyh0aGlzLm9wdGlvbnMubWFyZ2luVG9wKSxcclxuICAgICAgICBtQnRtID0gZW1DYWxjKHRoaXMub3B0aW9ucy5tYXJnaW5Cb3R0b20pLFxyXG4gICAgICAgIHRvcFBvaW50ID0gdGhpcy5wb2ludHMgPyB0aGlzLnBvaW50c1swXSA6IHRoaXMuJGFuY2hvci5vZmZzZXQoKS50b3AsXHJcbiAgICAgICAgYm90dG9tUG9pbnQgPSB0aGlzLnBvaW50cyA/IHRoaXMucG9pbnRzWzFdIDogdG9wUG9pbnQgKyB0aGlzLmFuY2hvckhlaWdodCxcclxuICAgICAgICAvLyB0b3BQb2ludCA9IHRoaXMuJGFuY2hvci5vZmZzZXQoKS50b3AgfHwgdGhpcy5wb2ludHNbMF0sXHJcbiAgICAgICAgLy8gYm90dG9tUG9pbnQgPSB0b3BQb2ludCArIHRoaXMuYW5jaG9ySGVpZ2h0IHx8IHRoaXMucG9pbnRzWzFdLFxyXG4gICAgICAgIHdpbkhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnN0aWNrVG8gPT09ICd0b3AnKSB7XHJcbiAgICAgIHRvcFBvaW50IC09IG1Ub3A7XHJcbiAgICAgIGJvdHRvbVBvaW50IC09IChlbGVtSGVpZ2h0ICsgbVRvcCk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5zdGlja1RvID09PSAnYm90dG9tJykge1xyXG4gICAgICB0b3BQb2ludCAtPSAod2luSGVpZ2h0IC0gKGVsZW1IZWlnaHQgKyBtQnRtKSk7XHJcbiAgICAgIGJvdHRvbVBvaW50IC09ICh3aW5IZWlnaHQgLSBtQnRtKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vdGhpcyB3b3VsZCBiZSB0aGUgc3RpY2tUbzogYm90aCBvcHRpb24uLi4gdHJpY2t5XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy50b3BQb2ludCA9IHRvcFBvaW50O1xyXG4gICAgdGhpcy5ib3R0b21Qb2ludCA9IGJvdHRvbVBvaW50O1xyXG5cclxuICAgIGlmIChjYiAmJiB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHsgY2IoKTsgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIGN1cnJlbnQgc3RpY2t5IGVsZW1lbnQuXHJcbiAgICogUmVzZXRzIHRoZSBlbGVtZW50IHRvIHRoZSB0b3AgcG9zaXRpb24gZmlyc3QuXHJcbiAgICogUmVtb3ZlcyBldmVudCBsaXN0ZW5lcnMsIEpTLWFkZGVkIGNzcyBwcm9wZXJ0aWVzIGFuZCBjbGFzc2VzLCBhbmQgdW53cmFwcyB0aGUgJGVsZW1lbnQgaWYgdGhlIEpTIGFkZGVkIHRoZSAkY29udGFpbmVyLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLl9yZW1vdmVTdGlja3kodHJ1ZSk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhgJHt0aGlzLm9wdGlvbnMuc3RpY2t5Q2xhc3N9IGlzLWFuY2hvcmVkIGlzLWF0LXRvcGApXHJcbiAgICAgICAgICAgICAgICAgLmNzcyh7XHJcbiAgICAgICAgICAgICAgICAgICBoZWlnaHQ6ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgdG9wOiAnJyxcclxuICAgICAgICAgICAgICAgICAgIGJvdHRvbTogJycsXHJcbiAgICAgICAgICAgICAgICAgICAnbWF4LXdpZHRoJzogJydcclxuICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgIC5vZmYoJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInKTtcclxuICAgIGlmICh0aGlzLiRhbmNob3IgJiYgdGhpcy4kYW5jaG9yLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLiRhbmNob3Iub2ZmKCdjaGFuZ2UuemYuc3RpY2t5Jyk7XHJcbiAgICB9XHJcbiAgICAkKHdpbmRvdykub2ZmKHRoaXMuc2Nyb2xsTGlzdGVuZXIpO1xyXG5cclxuICAgIGlmICh0aGlzLndhc1dyYXBwZWQpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC51bndyYXAoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuJGNvbnRhaW5lci5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuY29udGFpbmVyQ2xhc3MpXHJcbiAgICAgICAgICAgICAgICAgICAgIC5jc3Moe1xyXG4gICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogJydcclxuICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5TdGlja3kuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogQ3VzdG9taXphYmxlIGNvbnRhaW5lciB0ZW1wbGF0ZS4gQWRkIHlvdXIgb3duIGNsYXNzZXMgZm9yIHN0eWxpbmcgYW5kIHNpemluZy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJyZsdDtkaXYgZGF0YS1zdGlja3ktY29udGFpbmVyIGNsYXNzPVwic21hbGwtNiBjb2x1bW5zXCImZ3Q7Jmx0Oy9kaXYmZ3Q7J1xyXG4gICAqL1xyXG4gIGNvbnRhaW5lcjogJzxkaXYgZGF0YS1zdGlja3ktY29udGFpbmVyPjwvZGl2PicsXHJcbiAgLyoqXHJcbiAgICogTG9jYXRpb24gaW4gdGhlIHZpZXcgdGhlIGVsZW1lbnQgc3RpY2tzIHRvLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAndG9wJ1xyXG4gICAqL1xyXG4gIHN0aWNrVG86ICd0b3AnLFxyXG4gIC8qKlxyXG4gICAqIElmIGFuY2hvcmVkIHRvIGEgc2luZ2xlIGVsZW1lbnQsIHRoZSBpZCBvZiB0aGF0IGVsZW1lbnQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdleGFtcGxlSWQnXHJcbiAgICovXHJcbiAgYW5jaG9yOiAnJyxcclxuICAvKipcclxuICAgKiBJZiB1c2luZyBtb3JlIHRoYW4gb25lIGVsZW1lbnQgYXMgYW5jaG9yIHBvaW50cywgdGhlIGlkIG9mIHRoZSB0b3AgYW5jaG9yLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnZXhhbXBsZUlkOnRvcCdcclxuICAgKi9cclxuICB0b3BBbmNob3I6ICcnLFxyXG4gIC8qKlxyXG4gICAqIElmIHVzaW5nIG1vcmUgdGhhbiBvbmUgZWxlbWVudCBhcyBhbmNob3IgcG9pbnRzLCB0aGUgaWQgb2YgdGhlIGJvdHRvbSBhbmNob3IuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdleGFtcGxlSWQ6Ym90dG9tJ1xyXG4gICAqL1xyXG4gIGJ0bUFuY2hvcjogJycsXHJcbiAgLyoqXHJcbiAgICogTWFyZ2luLCBpbiBgZW1gJ3MgdG8gYXBwbHkgdG8gdGhlIHRvcCBvZiB0aGUgZWxlbWVudCB3aGVuIGl0IGJlY29tZXMgc3RpY2t5LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxXHJcbiAgICovXHJcbiAgbWFyZ2luVG9wOiAxLFxyXG4gIC8qKlxyXG4gICAqIE1hcmdpbiwgaW4gYGVtYCdzIHRvIGFwcGx5IHRvIHRoZSBib3R0b20gb2YgdGhlIGVsZW1lbnQgd2hlbiBpdCBiZWNvbWVzIHN0aWNreS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMVxyXG4gICAqL1xyXG4gIG1hcmdpbkJvdHRvbTogMSxcclxuICAvKipcclxuICAgKiBCcmVha3BvaW50IHN0cmluZyB0aGF0IGlzIHRoZSBtaW5pbXVtIHNjcmVlbiBzaXplIGFuIGVsZW1lbnQgc2hvdWxkIGJlY29tZSBzdGlja3kuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdtZWRpdW0nXHJcbiAgICovXHJcbiAgc3RpY2t5T246ICdtZWRpdW0nLFxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gc3RpY2t5IGVsZW1lbnQsIGFuZCByZW1vdmVkIG9uIGRlc3RydWN0aW9uLiBGb3VuZGF0aW9uIGRlZmF1bHRzIHRvIGBzdGlja3lgLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnc3RpY2t5J1xyXG4gICAqL1xyXG4gIHN0aWNreUNsYXNzOiAnc3RpY2t5JyxcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHN0aWNreSBjb250YWluZXIuIEZvdW5kYXRpb24gZGVmYXVsdHMgdG8gYHN0aWNreS1jb250YWluZXJgLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnc3RpY2t5LWNvbnRhaW5lcidcclxuICAgKi9cclxuICBjb250YWluZXJDbGFzczogJ3N0aWNreS1jb250YWluZXInLFxyXG4gIC8qKlxyXG4gICAqIE51bWJlciBvZiBzY3JvbGwgZXZlbnRzIGJldHdlZW4gdGhlIHBsdWdpbidzIHJlY2FsY3VsYXRpbmcgc3RpY2t5IHBvaW50cy4gU2V0dGluZyBpdCB0byBgMGAgd2lsbCBjYXVzZSBpdCB0byByZWNhbGMgZXZlcnkgc2Nyb2xsIGV2ZW50LCBzZXR0aW5nIGl0IHRvIGAtMWAgd2lsbCBwcmV2ZW50IHJlY2FsYyBvbiBzY3JvbGwuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwXHJcbiAgICovXHJcbiAgY2hlY2tFdmVyeTogLTFcclxufTtcclxuXHJcbi8qKlxyXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gY2FsY3VsYXRlIGVtIHZhbHVlc1xyXG4gKiBAcGFyYW0gTnVtYmVyIHtlbX0gLSBudW1iZXIgb2YgZW0ncyB0byBjYWxjdWxhdGUgaW50byBwaXhlbHNcclxuICovXHJcbmZ1bmN0aW9uIGVtQ2FsYyhlbSkge1xyXG4gIHJldHVybiBwYXJzZUludCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5LCBudWxsKS5mb250U2l6ZSwgMTApICogZW07XHJcbn1cclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFN0aWNreSwgJ1N0aWNreScpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFRhYnMgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24udGFic1xyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudGltZXJBbmRJbWFnZUxvYWRlciBpZiB0YWJzIGNvbnRhaW4gaW1hZ2VzXHJcbiAqL1xyXG5cclxuY2xhc3MgVGFicyB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiB0YWJzLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBUYWJzI2luaXRcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIHRhYnMuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIFRhYnMuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdUYWJzJyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdUYWJzJywge1xyXG4gICAgICAnRU5URVInOiAnb3BlbicsXHJcbiAgICAgICdTUEFDRSc6ICdvcGVuJyxcclxuICAgICAgJ0FSUk9XX1JJR0hUJzogJ25leHQnLFxyXG4gICAgICAnQVJST1dfVVAnOiAncHJldmlvdXMnLFxyXG4gICAgICAnQVJST1dfRE9XTic6ICduZXh0JyxcclxuICAgICAgJ0FSUk9XX0xFRlQnOiAncHJldmlvdXMnXHJcbiAgICAgIC8vICdUQUInOiAnbmV4dCcsXHJcbiAgICAgIC8vICdTSElGVF9UQUInOiAncHJldmlvdXMnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSB0YWJzIGJ5IHNob3dpbmcgYW5kIGZvY3VzaW5nIChpZiBhdXRvRm9jdXM9dHJ1ZSkgdGhlIHByZXNldCBhY3RpdmUgdGFiLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cih7J3JvbGUnOiAndGFibGlzdCd9KTtcclxuICAgIHRoaXMuJHRhYlRpdGxlcyA9IHRoaXMuJGVsZW1lbnQuZmluZChgLiR7dGhpcy5vcHRpb25zLmxpbmtDbGFzc31gKTtcclxuICAgIHRoaXMuJHRhYkNvbnRlbnQgPSAkKGBbZGF0YS10YWJzLWNvbnRlbnQ9XCIke3RoaXMuJGVsZW1lbnRbMF0uaWR9XCJdYCk7XHJcblxyXG4gICAgdGhpcy4kdGFiVGl0bGVzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgdmFyICRlbGVtID0gJCh0aGlzKSxcclxuICAgICAgICAgICRsaW5rID0gJGVsZW0uZmluZCgnYScpLFxyXG4gICAgICAgICAgaXNBY3RpdmUgPSAkZWxlbS5oYXNDbGFzcyhgJHtfdGhpcy5vcHRpb25zLmxpbmtBY3RpdmVDbGFzc31gKSxcclxuICAgICAgICAgIGhhc2ggPSAkbGlua1swXS5oYXNoLnNsaWNlKDEpLFxyXG4gICAgICAgICAgbGlua0lkID0gJGxpbmtbMF0uaWQgPyAkbGlua1swXS5pZCA6IGAke2hhc2h9LWxhYmVsYCxcclxuICAgICAgICAgICR0YWJDb250ZW50ID0gJChgIyR7aGFzaH1gKTtcclxuXHJcbiAgICAgICRlbGVtLmF0dHIoeydyb2xlJzogJ3ByZXNlbnRhdGlvbid9KTtcclxuXHJcbiAgICAgICRsaW5rLmF0dHIoe1xyXG4gICAgICAgICdyb2xlJzogJ3RhYicsXHJcbiAgICAgICAgJ2FyaWEtY29udHJvbHMnOiBoYXNoLFxyXG4gICAgICAgICdhcmlhLXNlbGVjdGVkJzogaXNBY3RpdmUsXHJcbiAgICAgICAgJ2lkJzogbGlua0lkXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgJHRhYkNvbnRlbnQuYXR0cih7XHJcbiAgICAgICAgJ3JvbGUnOiAndGFicGFuZWwnLFxyXG4gICAgICAgICdhcmlhLWhpZGRlbic6ICFpc0FjdGl2ZSxcclxuICAgICAgICAnYXJpYS1sYWJlbGxlZGJ5JzogbGlua0lkXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYoaXNBY3RpdmUgJiYgX3RoaXMub3B0aW9ucy5hdXRvRm9jdXMpe1xyXG4gICAgICAgICQod2luZG93KS5sb2FkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJCgnaHRtbCwgYm9keScpLmFuaW1hdGUoeyBzY3JvbGxUb3A6ICRlbGVtLm9mZnNldCgpLnRvcCB9LCBfdGhpcy5vcHRpb25zLmRlZXBMaW5rU211ZGdlRGVsYXksICgpID0+IHtcclxuICAgICAgICAgICAgJGxpbmsuZm9jdXMoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvL3VzZSBicm93c2VyIHRvIG9wZW4gYSB0YWIsIGlmIGl0IGV4aXN0cyBpbiB0aGlzIHRhYnNldFxyXG4gICAgICBpZiAoX3RoaXMub3B0aW9ucy5kZWVwTGluaykge1xyXG4gICAgICAgIHZhciBhbmNob3IgPSB3aW5kb3cubG9jYXRpb24uaGFzaDtcclxuICAgICAgICAvL25lZWQgYSBoYXNoIGFuZCBhIHJlbGV2YW50IGFuY2hvciBpbiB0aGlzIHRhYnNldFxyXG4gICAgICAgIGlmKGFuY2hvci5sZW5ndGgpIHtcclxuICAgICAgICAgIHZhciAkbGluayA9ICRlbGVtLmZpbmQoJ1tocmVmPVwiJythbmNob3IrJ1wiXScpO1xyXG4gICAgICAgICAgaWYgKCRsaW5rLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBfdGhpcy5zZWxlY3RUYWIoJChhbmNob3IpKTtcclxuXHJcbiAgICAgICAgICAgIC8vcm9sbCB1cCBhIGxpdHRsZSB0byBzaG93IHRoZSB0aXRsZXNcclxuICAgICAgICAgICAgaWYgKF90aGlzLm9wdGlvbnMuZGVlcExpbmtTbXVkZ2UpIHtcclxuICAgICAgICAgICAgICAkKHdpbmRvdykubG9hZChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHZhciBvZmZzZXQgPSAkZWxlbS5vZmZzZXQoKTtcclxuICAgICAgICAgICAgICAgICQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKHsgc2Nyb2xsVG9wOiBvZmZzZXQudG9wIH0sIF90aGlzLm9wdGlvbnMuZGVlcExpbmtTbXVkZ2VEZWxheSk7XHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgenBsdWdpbiBoYXMgZGVlcGxpbmtlZCBhdCBwYWdlbG9hZFxyXG4gICAgICAgICAgICAgICogQGV2ZW50IFRhYnMjZGVlcGxpbmtcclxuICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgJGVsZW0udHJpZ2dlcignZGVlcGxpbmsuemYudGFicycsIFskbGluaywgJChhbmNob3IpXSk7XHJcbiAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYodGhpcy5vcHRpb25zLm1hdGNoSGVpZ2h0KSB7XHJcbiAgICAgIHZhciAkaW1hZ2VzID0gdGhpcy4kdGFiQ29udGVudC5maW5kKCdpbWcnKTtcclxuXHJcbiAgICAgIGlmICgkaW1hZ2VzLmxlbmd0aCkge1xyXG4gICAgICAgIEZvdW5kYXRpb24ub25JbWFnZXNMb2FkZWQoJGltYWdlcywgdGhpcy5fc2V0SGVpZ2h0LmJpbmQodGhpcykpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuX3NldEhlaWdodCgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIGZvciBpdGVtcyB3aXRoaW4gdGhlIHRhYnMuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdGhpcy5fYWRkS2V5SGFuZGxlcigpO1xyXG4gICAgdGhpcy5fYWRkQ2xpY2tIYW5kbGVyKCk7XHJcbiAgICB0aGlzLl9zZXRIZWlnaHRNcUhhbmRsZXIgPSBudWxsO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMubWF0Y2hIZWlnaHQpIHtcclxuICAgICAgdGhpcy5fc2V0SGVpZ2h0TXFIYW5kbGVyID0gdGhpcy5fc2V0SGVpZ2h0LmJpbmQodGhpcyk7XHJcblxyXG4gICAgICAkKHdpbmRvdykub24oJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIHRoaXMuX3NldEhlaWdodE1xSGFuZGxlcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGNsaWNrIGhhbmRsZXJzIGZvciBpdGVtcyB3aXRoaW4gdGhlIHRhYnMuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfYWRkQ2xpY2tIYW5kbGVyKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5vZmYoJ2NsaWNrLnpmLnRhYnMnKVxyXG4gICAgICAub24oJ2NsaWNrLnpmLnRhYnMnLCBgLiR7dGhpcy5vcHRpb25zLmxpbmtDbGFzc31gLCBmdW5jdGlvbihlKXtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICBfdGhpcy5faGFuZGxlVGFiQ2hhbmdlKCQodGhpcykpO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMga2V5Ym9hcmQgZXZlbnQgaGFuZGxlcnMgZm9yIGl0ZW1zIHdpdGhpbiB0aGUgdGFicy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9hZGRLZXlIYW5kbGVyKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiR0YWJUaXRsZXMub2ZmKCdrZXlkb3duLnpmLnRhYnMnKS5vbigna2V5ZG93bi56Zi50YWJzJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgIGlmIChlLndoaWNoID09PSA5KSByZXR1cm47XHJcblxyXG5cclxuICAgICAgdmFyICRlbGVtZW50ID0gJCh0aGlzKSxcclxuICAgICAgICAkZWxlbWVudHMgPSAkZWxlbWVudC5wYXJlbnQoJ3VsJykuY2hpbGRyZW4oJ2xpJyksXHJcbiAgICAgICAgJHByZXZFbGVtZW50LFxyXG4gICAgICAgICRuZXh0RWxlbWVudDtcclxuXHJcbiAgICAgICRlbGVtZW50cy5lYWNoKGZ1bmN0aW9uKGkpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS5pcygkZWxlbWVudCkpIHtcclxuICAgICAgICAgIGlmIChfdGhpcy5vcHRpb25zLndyYXBPbktleXMpIHtcclxuICAgICAgICAgICAgJHByZXZFbGVtZW50ID0gaSA9PT0gMCA/ICRlbGVtZW50cy5sYXN0KCkgOiAkZWxlbWVudHMuZXEoaS0xKTtcclxuICAgICAgICAgICAgJG5leHRFbGVtZW50ID0gaSA9PT0gJGVsZW1lbnRzLmxlbmd0aCAtMSA/ICRlbGVtZW50cy5maXJzdCgpIDogJGVsZW1lbnRzLmVxKGkrMSk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAkcHJldkVsZW1lbnQgPSAkZWxlbWVudHMuZXEoTWF0aC5tYXgoMCwgaS0xKSk7XHJcbiAgICAgICAgICAgICRuZXh0RWxlbWVudCA9ICRlbGVtZW50cy5lcShNYXRoLm1pbihpKzEsICRlbGVtZW50cy5sZW5ndGgtMSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBoYW5kbGUga2V5Ym9hcmQgZXZlbnQgd2l0aCBrZXlib2FyZCB1dGlsXHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdUYWJzJywge1xyXG4gICAgICAgIG9wZW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJGVsZW1lbnQuZmluZCgnW3JvbGU9XCJ0YWJcIl0nKS5mb2N1cygpO1xyXG4gICAgICAgICAgX3RoaXMuX2hhbmRsZVRhYkNoYW5nZSgkZWxlbWVudCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBwcmV2aW91czogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQuZmluZCgnW3JvbGU9XCJ0YWJcIl0nKS5mb2N1cygpO1xyXG4gICAgICAgICAgX3RoaXMuX2hhbmRsZVRhYkNoYW5nZSgkcHJldkVsZW1lbnQpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQuZmluZCgnW3JvbGU9XCJ0YWJcIl0nKS5mb2N1cygpO1xyXG4gICAgICAgICAgX3RoaXMuX2hhbmRsZVRhYkNoYW5nZSgkbmV4dEVsZW1lbnQpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIHRoZSB0YWIgYCR0YXJnZXRDb250ZW50YCBkZWZpbmVkIGJ5IGAkdGFyZ2V0YC4gQ29sbGFwc2VzIGFjdGl2ZSB0YWIuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBUYWIgdG8gb3Blbi5cclxuICAgKiBAZmlyZXMgVGFicyNjaGFuZ2VcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBfaGFuZGxlVGFiQ2hhbmdlKCR0YXJnZXQpIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrIGZvciBhY3RpdmUgY2xhc3Mgb24gdGFyZ2V0LiBDb2xsYXBzZSBpZiBleGlzdHMuXHJcbiAgICAgKi9cclxuICAgIGlmICgkdGFyZ2V0Lmhhc0NsYXNzKGAke3RoaXMub3B0aW9ucy5saW5rQWN0aXZlQ2xhc3N9YCkpIHtcclxuICAgICAgICBpZih0aGlzLm9wdGlvbnMuYWN0aXZlQ29sbGFwc2UpIHtcclxuICAgICAgICAgICAgdGhpcy5fY29sbGFwc2VUYWIoJHRhcmdldCk7XHJcblxyXG4gICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIHpwbHVnaW4gaGFzIHN1Y2Nlc3NmdWxseSBjb2xsYXBzZWQgdGFicy5cclxuICAgICAgICAgICAgKiBAZXZlbnQgVGFicyNjb2xsYXBzZVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2NvbGxhcHNlLnpmLnRhYnMnLCBbJHRhcmdldF0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdmFyICRvbGRUYWIgPSB0aGlzLiRlbGVtZW50LlxyXG4gICAgICAgICAgZmluZChgLiR7dGhpcy5vcHRpb25zLmxpbmtDbGFzc30uJHt0aGlzLm9wdGlvbnMubGlua0FjdGl2ZUNsYXNzfWApLFxyXG4gICAgICAgICAgJHRhYkxpbmsgPSAkdGFyZ2V0LmZpbmQoJ1tyb2xlPVwidGFiXCJdJyksXHJcbiAgICAgICAgICBoYXNoID0gJHRhYkxpbmtbMF0uaGFzaCxcclxuICAgICAgICAgICR0YXJnZXRDb250ZW50ID0gdGhpcy4kdGFiQ29udGVudC5maW5kKGhhc2gpO1xyXG5cclxuICAgIC8vY2xvc2Ugb2xkIHRhYlxyXG4gICAgdGhpcy5fY29sbGFwc2VUYWIoJG9sZFRhYik7XHJcblxyXG4gICAgLy9vcGVuIG5ldyB0YWJcclxuICAgIHRoaXMuX29wZW5UYWIoJHRhcmdldCk7XHJcblxyXG4gICAgLy9laXRoZXIgcmVwbGFjZSBvciB1cGRhdGUgYnJvd3NlciBoaXN0b3J5XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmRlZXBMaW5rKSB7XHJcbiAgICAgIHZhciBhbmNob3IgPSAkdGFyZ2V0LmZpbmQoJ2EnKS5hdHRyKCdocmVmJyk7XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnVwZGF0ZUhpc3RvcnkpIHtcclxuICAgICAgICBoaXN0b3J5LnB1c2hTdGF0ZSh7fSwgJycsIGFuY2hvcik7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaGlzdG9yeS5yZXBsYWNlU3RhdGUoe30sICcnLCBhbmNob3IpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBwbHVnaW4gaGFzIHN1Y2Nlc3NmdWxseSBjaGFuZ2VkIHRhYnMuXHJcbiAgICAgKiBAZXZlbnQgVGFicyNjaGFuZ2VcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjaGFuZ2UuemYudGFicycsIFskdGFyZ2V0LCAkdGFyZ2V0Q29udGVudF0pO1xyXG5cclxuICAgIC8vZmlyZSB0byBjaGlsZHJlbiBhIG11dGF0aW9uIGV2ZW50XHJcbiAgICAkdGFyZ2V0Q29udGVudC5maW5kKFwiW2RhdGEtbXV0YXRlXVwiKS50cmlnZ2VyKFwibXV0YXRlbWUuemYudHJpZ2dlclwiKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIHRoZSB0YWIgYCR0YXJnZXRDb250ZW50YCBkZWZpbmVkIGJ5IGAkdGFyZ2V0YC5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIFRhYiB0byBPcGVuLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIF9vcGVuVGFiKCR0YXJnZXQpIHtcclxuICAgICAgdmFyICR0YWJMaW5rID0gJHRhcmdldC5maW5kKCdbcm9sZT1cInRhYlwiXScpLFxyXG4gICAgICAgICAgaGFzaCA9ICR0YWJMaW5rWzBdLmhhc2gsXHJcbiAgICAgICAgICAkdGFyZ2V0Q29udGVudCA9IHRoaXMuJHRhYkNvbnRlbnQuZmluZChoYXNoKTtcclxuXHJcbiAgICAgICR0YXJnZXQuYWRkQ2xhc3MoYCR7dGhpcy5vcHRpb25zLmxpbmtBY3RpdmVDbGFzc31gKTtcclxuXHJcbiAgICAgICR0YWJMaW5rLmF0dHIoeydhcmlhLXNlbGVjdGVkJzogJ3RydWUnfSk7XHJcblxyXG4gICAgICAkdGFyZ2V0Q29udGVudFxyXG4gICAgICAgIC5hZGRDbGFzcyhgJHt0aGlzLm9wdGlvbnMucGFuZWxBY3RpdmVDbGFzc31gKVxyXG4gICAgICAgIC5hdHRyKHsnYXJpYS1oaWRkZW4nOiAnZmFsc2UnfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb2xsYXBzZXMgYCR0YXJnZXRDb250ZW50YCBkZWZpbmVkIGJ5IGAkdGFyZ2V0YC5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIFRhYiB0byBPcGVuLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIF9jb2xsYXBzZVRhYigkdGFyZ2V0KSB7XHJcbiAgICB2YXIgJHRhcmdldF9hbmNob3IgPSAkdGFyZ2V0XHJcbiAgICAgIC5yZW1vdmVDbGFzcyhgJHt0aGlzLm9wdGlvbnMubGlua0FjdGl2ZUNsYXNzfWApXHJcbiAgICAgIC5maW5kKCdbcm9sZT1cInRhYlwiXScpXHJcbiAgICAgIC5hdHRyKHsgJ2FyaWEtc2VsZWN0ZWQnOiAnZmFsc2UnIH0pO1xyXG5cclxuICAgICQoYCMkeyR0YXJnZXRfYW5jaG9yLmF0dHIoJ2FyaWEtY29udHJvbHMnKX1gKVxyXG4gICAgICAucmVtb3ZlQ2xhc3MoYCR7dGhpcy5vcHRpb25zLnBhbmVsQWN0aXZlQ2xhc3N9YClcclxuICAgICAgLmF0dHIoeyAnYXJpYS1oaWRkZW4nOiAndHJ1ZScgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQdWJsaWMgbWV0aG9kIGZvciBzZWxlY3RpbmcgYSBjb250ZW50IHBhbmUgdG8gZGlzcGxheS5cclxuICAgKiBAcGFyYW0ge2pRdWVyeSB8IFN0cmluZ30gZWxlbSAtIGpRdWVyeSBvYmplY3Qgb3Igc3RyaW5nIG9mIHRoZSBpZCBvZiB0aGUgcGFuZSB0byBkaXNwbGF5LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHNlbGVjdFRhYihlbGVtKSB7XHJcbiAgICB2YXIgaWRTdHI7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBlbGVtID09PSAnb2JqZWN0Jykge1xyXG4gICAgICBpZFN0ciA9IGVsZW1bMF0uaWQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZFN0ciA9IGVsZW07XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGlkU3RyLmluZGV4T2YoJyMnKSA8IDApIHtcclxuICAgICAgaWRTdHIgPSBgIyR7aWRTdHJ9YDtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgJHRhcmdldCA9IHRoaXMuJHRhYlRpdGxlcy5maW5kKGBbaHJlZj1cIiR7aWRTdHJ9XCJdYCkucGFyZW50KGAuJHt0aGlzLm9wdGlvbnMubGlua0NsYXNzfWApO1xyXG5cclxuICAgIHRoaXMuX2hhbmRsZVRhYkNoYW5nZSgkdGFyZ2V0KTtcclxuICB9O1xyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGhlaWdodCBvZiBlYWNoIHBhbmVsIHRvIHRoZSBoZWlnaHQgb2YgdGhlIHRhbGxlc3QgcGFuZWwuXHJcbiAgICogSWYgZW5hYmxlZCBpbiBvcHRpb25zLCBnZXRzIGNhbGxlZCBvbiBtZWRpYSBxdWVyeSBjaGFuZ2UuXHJcbiAgICogSWYgbG9hZGluZyBjb250ZW50IHZpYSBleHRlcm5hbCBzb3VyY2UsIGNhbiBiZSBjYWxsZWQgZGlyZWN0bHkgb3Igd2l0aCBfcmVmbG93LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3NldEhlaWdodCgpIHtcclxuICAgIHZhciBtYXggPSAwO1xyXG4gICAgdGhpcy4kdGFiQ29udGVudFxyXG4gICAgICAuZmluZChgLiR7dGhpcy5vcHRpb25zLnBhbmVsQ2xhc3N9YClcclxuICAgICAgLmNzcygnaGVpZ2h0JywgJycpXHJcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBwYW5lbCA9ICQodGhpcyksXHJcbiAgICAgICAgICAgIGlzQWN0aXZlID0gcGFuZWwuaGFzQ2xhc3MoYCR7dGhpcy5vcHRpb25zLnBhbmVsQWN0aXZlQ2xhc3N9YCk7XHJcblxyXG4gICAgICAgIGlmICghaXNBY3RpdmUpIHtcclxuICAgICAgICAgIHBhbmVsLmNzcyh7J3Zpc2liaWxpdHknOiAnaGlkZGVuJywgJ2Rpc3BsYXknOiAnYmxvY2snfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgdGVtcCA9IHRoaXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xyXG5cclxuICAgICAgICBpZiAoIWlzQWN0aXZlKSB7XHJcbiAgICAgICAgICBwYW5lbC5jc3Moe1xyXG4gICAgICAgICAgICAndmlzaWJpbGl0eSc6ICcnLFxyXG4gICAgICAgICAgICAnZGlzcGxheSc6ICcnXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG1heCA9IHRlbXAgPiBtYXggPyB0ZW1wIDogbWF4O1xyXG4gICAgICB9KVxyXG4gICAgICAuY3NzKCdoZWlnaHQnLCBgJHttYXh9cHhgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIGFuIHRhYnMuXHJcbiAgICogQGZpcmVzIFRhYnMjZGVzdHJveWVkXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLmZpbmQoYC4ke3RoaXMub3B0aW9ucy5saW5rQ2xhc3N9YClcclxuICAgICAgLm9mZignLnpmLnRhYnMnKS5oaWRlKCkuZW5kKClcclxuICAgICAgLmZpbmQoYC4ke3RoaXMub3B0aW9ucy5wYW5lbENsYXNzfWApXHJcbiAgICAgIC5oaWRlKCk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5tYXRjaEhlaWdodCkge1xyXG4gICAgICBpZiAodGhpcy5fc2V0SGVpZ2h0TXFIYW5kbGVyICE9IG51bGwpIHtcclxuICAgICAgICAgJCh3aW5kb3cpLm9mZignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgdGhpcy5fc2V0SGVpZ2h0TXFIYW5kbGVyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcblRhYnMuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSB3aW5kb3cgdG8gc2Nyb2xsIHRvIGNvbnRlbnQgb2YgcGFuZSBzcGVjaWZpZWQgYnkgaGFzaCBhbmNob3JcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBkZWVwTGluazogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFkanVzdCB0aGUgZGVlcCBsaW5rIHNjcm9sbCB0byBtYWtlIHN1cmUgdGhlIHRvcCBvZiB0aGUgdGFiIHBhbmVsIGlzIHZpc2libGVcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBkZWVwTGlua1NtdWRnZTogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFuaW1hdGlvbiB0aW1lIChtcykgZm9yIHRoZSBkZWVwIGxpbmsgYWRqdXN0bWVudFxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAzMDBcclxuICAgKi9cclxuICBkZWVwTGlua1NtdWRnZURlbGF5OiAzMDAsXHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB0aGUgYnJvd3NlciBoaXN0b3J5IHdpdGggdGhlIG9wZW4gdGFiXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgdXBkYXRlSGlzdG9yeTogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgd2luZG93IHRvIHNjcm9sbCB0byBjb250ZW50IG9mIGFjdGl2ZSBwYW5lIG9uIGxvYWQgaWYgc2V0IHRvIHRydWUuXHJcbiAgICogTm90IHJlY29tbWVuZGVkIGlmIG1vcmUgdGhhbiBvbmUgdGFiIHBhbmVsIHBlciBwYWdlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGF1dG9Gb2N1czogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyBrZXlib2FyZCBpbnB1dCB0byAnd3JhcCcgYXJvdW5kIHRoZSB0YWIgbGlua3MuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICB3cmFwT25LZXlzOiB0cnVlLFxyXG5cclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHRhYiBjb250ZW50IHBhbmVzIHRvIG1hdGNoIGhlaWdodHMgaWYgc2V0IHRvIHRydWUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgbWF0Y2hIZWlnaHQ6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBBbGxvd3MgYWN0aXZlIHRhYnMgdG8gY29sbGFwc2Ugd2hlbiBjbGlja2VkLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGFjdGl2ZUNvbGxhcHNlOiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byBgbGlgJ3MgaW4gdGFiIGxpbmsgbGlzdC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3RhYnMtdGl0bGUnXHJcbiAgICovXHJcbiAgbGlua0NsYXNzOiAndGFicy10aXRsZScsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGFjdGl2ZSBgbGlgIGluIHRhYiBsaW5rIGxpc3QuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdpcy1hY3RpdmUnXHJcbiAgICovXHJcbiAgbGlua0FjdGl2ZUNsYXNzOiAnaXMtYWN0aXZlJyxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byB0aGUgY29udGVudCBjb250YWluZXJzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAndGFicy1wYW5lbCdcclxuICAgKi9cclxuICBwYW5lbENsYXNzOiAndGFicy1wYW5lbCcsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGFjdGl2ZSBjb250ZW50IGNvbnRhaW5lci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2lzLWFjdGl2ZSdcclxuICAgKi9cclxuICBwYW5lbEFjdGl2ZUNsYXNzOiAnaXMtYWN0aXZlJ1xyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oVGFicywgJ1RhYnMnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBUb2dnbGVyIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnRvZ2dsZXJcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKi9cclxuXHJcbmNsYXNzIFRvZ2dsZXIge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgVG9nZ2xlci5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgVG9nZ2xlciNpbml0XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGFkZCB0aGUgdHJpZ2dlciB0by5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgVG9nZ2xlci5kZWZhdWx0cywgZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG4gICAgdGhpcy5jbGFzc05hbWUgPSAnJztcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdUb2dnbGVyJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgVG9nZ2xlciBwbHVnaW4gYnkgcGFyc2luZyB0aGUgdG9nZ2xlIGNsYXNzIGZyb20gZGF0YS10b2dnbGVyLCBvciBhbmltYXRpb24gY2xhc3NlcyBmcm9tIGRhdGEtYW5pbWF0ZS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIGlucHV0O1xyXG4gICAgLy8gUGFyc2UgYW5pbWF0aW9uIGNsYXNzZXMgaWYgdGhleSB3ZXJlIHNldFxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hbmltYXRlKSB7XHJcbiAgICAgIGlucHV0ID0gdGhpcy5vcHRpb25zLmFuaW1hdGUuc3BsaXQoJyAnKTtcclxuXHJcbiAgICAgIHRoaXMuYW5pbWF0aW9uSW4gPSBpbnB1dFswXTtcclxuICAgICAgdGhpcy5hbmltYXRpb25PdXQgPSBpbnB1dFsxXSB8fCBudWxsO1xyXG4gICAgfVxyXG4gICAgLy8gT3RoZXJ3aXNlLCBwYXJzZSB0b2dnbGUgY2xhc3NcclxuICAgIGVsc2Uge1xyXG4gICAgICBpbnB1dCA9IHRoaXMuJGVsZW1lbnQuZGF0YSgndG9nZ2xlcicpO1xyXG4gICAgICAvLyBBbGxvdyBmb3IgYSAuIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHN0cmluZ1xyXG4gICAgICB0aGlzLmNsYXNzTmFtZSA9IGlucHV0WzBdID09PSAnLicgPyBpbnB1dC5zbGljZSgxKSA6IGlucHV0O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCBBUklBIGF0dHJpYnV0ZXMgdG8gdHJpZ2dlcnNcclxuICAgIHZhciBpZCA9IHRoaXMuJGVsZW1lbnRbMF0uaWQ7XHJcbiAgICAkKGBbZGF0YS1vcGVuPVwiJHtpZH1cIl0sIFtkYXRhLWNsb3NlPVwiJHtpZH1cIl0sIFtkYXRhLXRvZ2dsZT1cIiR7aWR9XCJdYClcclxuICAgICAgLmF0dHIoJ2FyaWEtY29udHJvbHMnLCBpZCk7XHJcbiAgICAvLyBJZiB0aGUgdGFyZ2V0IGlzIGhpZGRlbiwgYWRkIGFyaWEtaGlkZGVuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCB0aGlzLiRlbGVtZW50LmlzKCc6aGlkZGVuJykgPyBmYWxzZSA6IHRydWUpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgZXZlbnRzIGZvciB0aGUgdG9nZ2xlIHRyaWdnZXIuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJ3RvZ2dsZS56Zi50cmlnZ2VyJykub24oJ3RvZ2dsZS56Zi50cmlnZ2VyJywgdGhpcy50b2dnbGUuYmluZCh0aGlzKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHRoZSB0YXJnZXQgY2xhc3Mgb24gdGhlIHRhcmdldCBlbGVtZW50LiBBbiBldmVudCBpcyBmaXJlZCBmcm9tIHRoZSBvcmlnaW5hbCB0cmlnZ2VyIGRlcGVuZGluZyBvbiBpZiB0aGUgcmVzdWx0YW50IHN0YXRlIHdhcyBcIm9uXCIgb3IgXCJvZmZcIi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgVG9nZ2xlciNvblxyXG4gICAqIEBmaXJlcyBUb2dnbGVyI29mZlxyXG4gICAqL1xyXG4gIHRvZ2dsZSgpIHtcclxuICAgIHRoaXNbIHRoaXMub3B0aW9ucy5hbmltYXRlID8gJ190b2dnbGVBbmltYXRlJyA6ICdfdG9nZ2xlQ2xhc3MnXSgpO1xyXG4gIH1cclxuXHJcbiAgX3RvZ2dsZUNsYXNzKCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC50b2dnbGVDbGFzcyh0aGlzLmNsYXNzTmFtZSk7XHJcblxyXG4gICAgdmFyIGlzT24gPSB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKHRoaXMuY2xhc3NOYW1lKTtcclxuICAgIGlmIChpc09uKSB7XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBGaXJlcyBpZiB0aGUgdGFyZ2V0IGVsZW1lbnQgaGFzIHRoZSBjbGFzcyBhZnRlciBhIHRvZ2dsZS5cclxuICAgICAgICogQGV2ZW50IFRvZ2dsZXIjb25cclxuICAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignb24uemYudG9nZ2xlcicpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBGaXJlcyBpZiB0aGUgdGFyZ2V0IGVsZW1lbnQgZG9lcyBub3QgaGF2ZSB0aGUgY2xhc3MgYWZ0ZXIgYSB0b2dnbGUuXHJcbiAgICAgICAqIEBldmVudCBUb2dnbGVyI29mZlxyXG4gICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdvZmYuemYudG9nZ2xlcicpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3VwZGF0ZUFSSUEoaXNPbik7XHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLW11dGF0ZV0nKS50cmlnZ2VyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJyk7XHJcbiAgfVxyXG5cclxuICBfdG9nZ2xlQW5pbWF0ZSgpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgaWYgKHRoaXMuJGVsZW1lbnQuaXMoJzpoaWRkZW4nKSkge1xyXG4gICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlSW4odGhpcy4kZWxlbWVudCwgdGhpcy5hbmltYXRpb25JbiwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMuX3VwZGF0ZUFSSUEodHJ1ZSk7XHJcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdvbi56Zi50b2dnbGVyJyk7XHJcbiAgICAgICAgdGhpcy5maW5kKCdbZGF0YS1tdXRhdGVdJykudHJpZ2dlcignbXV0YXRlbWUuemYudHJpZ2dlcicpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlT3V0KHRoaXMuJGVsZW1lbnQsIHRoaXMuYW5pbWF0aW9uT3V0LCBmdW5jdGlvbigpIHtcclxuICAgICAgICBfdGhpcy5fdXBkYXRlQVJJQShmYWxzZSk7XHJcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdvZmYuemYudG9nZ2xlcicpO1xyXG4gICAgICAgIHRoaXMuZmluZCgnW2RhdGEtbXV0YXRlXScpLnRyaWdnZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBfdXBkYXRlQVJJQShpc09uKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCBpc09uID8gdHJ1ZSA6IGZhbHNlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBpbnN0YW5jZSBvZiBUb2dnbGVyIG9uIHRoZSBlbGVtZW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnRvZ2dsZXInKTtcclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcblRvZ2dsZXIuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogVGVsbHMgdGhlIHBsdWdpbiBpZiB0aGUgZWxlbWVudCBzaG91bGQgYW5pbWF0ZWQgd2hlbiB0b2dnbGVkLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGFuaW1hdGU6IGZhbHNlXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihUb2dnbGVyLCAnVG9nZ2xlcicpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFRvb2x0aXAgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24udG9vbHRpcFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmJveFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKi9cclxuXHJcbmNsYXNzIFRvb2x0aXAge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYSBUb29sdGlwLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBUb29sdGlwI2luaXRcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gYXR0YWNoIGEgdG9vbHRpcCB0by5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIG9iamVjdCB0byBleHRlbmQgdGhlIGRlZmF1bHQgY29uZmlndXJhdGlvbi5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBUb29sdGlwLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5pc0FjdGl2ZSA9IGZhbHNlO1xyXG4gICAgdGhpcy5pc0NsaWNrID0gZmFsc2U7XHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnVG9vbHRpcCcpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIHRvb2x0aXAgYnkgc2V0dGluZyB0aGUgY3JlYXRpbmcgdGhlIHRpcCBlbGVtZW50LCBhZGRpbmcgaXQncyB0ZXh0LCBzZXR0aW5nIHByaXZhdGUgdmFyaWFibGVzIGFuZCBzZXR0aW5nIGF0dHJpYnV0ZXMgb24gdGhlIGFuY2hvci5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIGVsZW1JZCA9IHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1kZXNjcmliZWRieScpIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ3Rvb2x0aXAnKTtcclxuXHJcbiAgICB0aGlzLm9wdGlvbnMucG9zaXRpb25DbGFzcyA9IHRoaXMub3B0aW9ucy5wb3NpdGlvbkNsYXNzIHx8IHRoaXMuX2dldFBvc2l0aW9uQ2xhc3ModGhpcy4kZWxlbWVudCk7XHJcbiAgICB0aGlzLm9wdGlvbnMudGlwVGV4dCA9IHRoaXMub3B0aW9ucy50aXBUZXh0IHx8IHRoaXMuJGVsZW1lbnQuYXR0cigndGl0bGUnKTtcclxuICAgIHRoaXMudGVtcGxhdGUgPSB0aGlzLm9wdGlvbnMudGVtcGxhdGUgPyAkKHRoaXMub3B0aW9ucy50ZW1wbGF0ZSkgOiB0aGlzLl9idWlsZFRlbXBsYXRlKGVsZW1JZCk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hbGxvd0h0bWwpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5hcHBlbmRUbyhkb2N1bWVudC5ib2R5KVxyXG4gICAgICAgIC5odG1sKHRoaXMub3B0aW9ucy50aXBUZXh0KVxyXG4gICAgICAgIC5oaWRlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLmFwcGVuZFRvKGRvY3VtZW50LmJvZHkpXHJcbiAgICAgICAgLnRleHQodGhpcy5vcHRpb25zLnRpcFRleHQpXHJcbiAgICAgICAgLmhpZGUoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoe1xyXG4gICAgICAndGl0bGUnOiAnJyxcclxuICAgICAgJ2FyaWEtZGVzY3JpYmVkYnknOiBlbGVtSWQsXHJcbiAgICAgICdkYXRhLXlldGktYm94JzogZWxlbUlkLFxyXG4gICAgICAnZGF0YS10b2dnbGUnOiBlbGVtSWQsXHJcbiAgICAgICdkYXRhLXJlc2l6ZSc6IGVsZW1JZFxyXG4gICAgfSkuYWRkQ2xhc3ModGhpcy5vcHRpb25zLnRyaWdnZXJDbGFzcyk7XHJcblxyXG4gICAgLy9oZWxwZXIgdmFyaWFibGVzIHRvIHRyYWNrIG1vdmVtZW50IG9uIGNvbGxpc2lvbnNcclxuICAgIHRoaXMudXNlZFBvc2l0aW9ucyA9IFtdO1xyXG4gICAgdGhpcy5jb3VudGVyID0gNDtcclxuICAgIHRoaXMuY2xhc3NDaGFuZ2VkID0gZmFsc2U7XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHcmFicyB0aGUgY3VycmVudCBwb3NpdGlvbmluZyBjbGFzcywgaWYgcHJlc2VudCwgYW5kIHJldHVybnMgdGhlIHZhbHVlIG9yIGFuIGVtcHR5IHN0cmluZy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9nZXRQb3NpdGlvbkNsYXNzKGVsZW1lbnQpIHtcclxuICAgIGlmICghZWxlbWVudCkgeyByZXR1cm4gJyc7IH1cclxuICAgIC8vIHZhciBwb3NpdGlvbiA9IGVsZW1lbnQuYXR0cignY2xhc3MnKS5tYXRjaCgvdG9wfGxlZnR8cmlnaHQvZyk7XHJcbiAgICB2YXIgcG9zaXRpb24gPSBlbGVtZW50WzBdLmNsYXNzTmFtZS5tYXRjaCgvXFxiKHRvcHxsZWZ0fHJpZ2h0KVxcYi9nKTtcclxuICAgICAgICBwb3NpdGlvbiA9IHBvc2l0aW9uID8gcG9zaXRpb25bMF0gOiAnJztcclxuICAgIHJldHVybiBwb3NpdGlvbjtcclxuICB9O1xyXG4gIC8qKlxyXG4gICAqIGJ1aWxkcyB0aGUgdG9vbHRpcCBlbGVtZW50LCBhZGRzIGF0dHJpYnV0ZXMsIGFuZCByZXR1cm5zIHRoZSB0ZW1wbGF0ZS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9idWlsZFRlbXBsYXRlKGlkKSB7XHJcbiAgICB2YXIgdGVtcGxhdGVDbGFzc2VzID0gKGAke3RoaXMub3B0aW9ucy50b29sdGlwQ2xhc3N9ICR7dGhpcy5vcHRpb25zLnBvc2l0aW9uQ2xhc3N9ICR7dGhpcy5vcHRpb25zLnRlbXBsYXRlQ2xhc3Nlc31gKS50cmltKCk7XHJcbiAgICB2YXIgJHRlbXBsYXRlID0gICQoJzxkaXY+PC9kaXY+JykuYWRkQ2xhc3ModGVtcGxhdGVDbGFzc2VzKS5hdHRyKHtcclxuICAgICAgJ3JvbGUnOiAndG9vbHRpcCcsXHJcbiAgICAgICdhcmlhLWhpZGRlbic6IHRydWUsXHJcbiAgICAgICdkYXRhLWlzLWFjdGl2ZSc6IGZhbHNlLFxyXG4gICAgICAnZGF0YS1pcy1mb2N1cyc6IGZhbHNlLFxyXG4gICAgICAnaWQnOiBpZFxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gJHRlbXBsYXRlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBpZiBhIGNvbGxpc2lvbiBldmVudCBpcyBkZXRlY3RlZC5cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gcG9zaXRpb24gLSBwb3NpdGlvbmluZyBjbGFzcyB0byB0cnlcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9yZXBvc2l0aW9uKHBvc2l0aW9uKSB7XHJcbiAgICB0aGlzLnVzZWRQb3NpdGlvbnMucHVzaChwb3NpdGlvbiA/IHBvc2l0aW9uIDogJ2JvdHRvbScpO1xyXG5cclxuICAgIC8vZGVmYXVsdCwgdHJ5IHN3aXRjaGluZyB0byBvcHBvc2l0ZSBzaWRlXHJcbiAgICBpZiAoIXBvc2l0aW9uICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigndG9wJykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLmFkZENsYXNzKCd0b3AnKTtcclxuICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICd0b3AnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICdsZWZ0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3JpZ2h0JykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZUNsYXNzKHBvc2l0aW9uKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdyaWdodCcpO1xyXG4gICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ3JpZ2h0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlQ2xhc3MocG9zaXRpb24pXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoJ2xlZnQnKTtcclxuICAgIH1cclxuXHJcbiAgICAvL2lmIGRlZmF1bHQgY2hhbmdlIGRpZG4ndCB3b3JrLCB0cnkgYm90dG9tIG9yIGxlZnQgZmlyc3RcclxuICAgIGVsc2UgaWYgKCFwb3NpdGlvbiAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3RvcCcpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5hZGRDbGFzcygnbGVmdCcpO1xyXG4gICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ3RvcCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlQ2xhc3MocG9zaXRpb24pXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoJ2xlZnQnKTtcclxuICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICdsZWZ0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3JpZ2h0JykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ3JpZ2h0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9XHJcbiAgICAvL2lmIG5vdGhpbmcgY2xlYXJlZCwgc2V0IHRvIGJvdHRvbVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jbGFzc0NoYW5nZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5jb3VudGVyLS07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBzZXRzIHRoZSBwb3NpdGlvbiBjbGFzcyBvZiBhbiBlbGVtZW50IGFuZCByZWN1cnNpdmVseSBjYWxscyBpdHNlbGYgdW50aWwgdGhlcmUgYXJlIG5vIG1vcmUgcG9zc2libGUgcG9zaXRpb25zIHRvIGF0dGVtcHQsIG9yIHRoZSB0b29sdGlwIGVsZW1lbnQgaXMgbm8gbG9uZ2VyIGNvbGxpZGluZy5cclxuICAgKiBpZiB0aGUgdG9vbHRpcCBpcyBsYXJnZXIgdGhhbiB0aGUgc2NyZWVuIHdpZHRoLCBkZWZhdWx0IHRvIGZ1bGwgd2lkdGggLSBhbnkgdXNlciBzZWxlY3RlZCBtYXJnaW5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zZXRQb3NpdGlvbigpIHtcclxuICAgIHZhciBwb3NpdGlvbiA9IHRoaXMuX2dldFBvc2l0aW9uQ2xhc3ModGhpcy50ZW1wbGF0ZSksXHJcbiAgICAgICAgJHRpcERpbXMgPSBGb3VuZGF0aW9uLkJveC5HZXREaW1lbnNpb25zKHRoaXMudGVtcGxhdGUpLFxyXG4gICAgICAgICRhbmNob3JEaW1zID0gRm91bmRhdGlvbi5Cb3guR2V0RGltZW5zaW9ucyh0aGlzLiRlbGVtZW50KSxcclxuICAgICAgICBkaXJlY3Rpb24gPSAocG9zaXRpb24gPT09ICdsZWZ0JyA/ICdsZWZ0JyA6ICgocG9zaXRpb24gPT09ICdyaWdodCcpID8gJ2xlZnQnIDogJ3RvcCcpKSxcclxuICAgICAgICBwYXJhbSA9IChkaXJlY3Rpb24gPT09ICd0b3AnKSA/ICdoZWlnaHQnIDogJ3dpZHRoJyxcclxuICAgICAgICBvZmZzZXQgPSAocGFyYW0gPT09ICdoZWlnaHQnKSA/IHRoaXMub3B0aW9ucy52T2Zmc2V0IDogdGhpcy5vcHRpb25zLmhPZmZzZXQsXHJcbiAgICAgICAgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGlmICgoJHRpcERpbXMud2lkdGggPj0gJHRpcERpbXMud2luZG93RGltcy53aWR0aCkgfHwgKCF0aGlzLmNvdW50ZXIgJiYgIUZvdW5kYXRpb24uQm94LkltTm90VG91Y2hpbmdZb3UodGhpcy50ZW1wbGF0ZSkpKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUub2Zmc2V0KEZvdW5kYXRpb24uQm94LkdldE9mZnNldHModGhpcy50ZW1wbGF0ZSwgdGhpcy4kZWxlbWVudCwgJ2NlbnRlciBib3R0b20nLCB0aGlzLm9wdGlvbnMudk9mZnNldCwgdGhpcy5vcHRpb25zLmhPZmZzZXQsIHRydWUpKS5jc3Moe1xyXG4gICAgICAvLyB0aGlzLiRlbGVtZW50Lm9mZnNldChGb3VuZGF0aW9uLkdldE9mZnNldHModGhpcy50ZW1wbGF0ZSwgdGhpcy4kZWxlbWVudCwgJ2NlbnRlciBib3R0b20nLCB0aGlzLm9wdGlvbnMudk9mZnNldCwgdGhpcy5vcHRpb25zLmhPZmZzZXQsIHRydWUpKS5jc3Moe1xyXG4gICAgICAgICd3aWR0aCc6ICRhbmNob3JEaW1zLndpbmRvd0RpbXMud2lkdGggLSAodGhpcy5vcHRpb25zLmhPZmZzZXQgKiAyKSxcclxuICAgICAgICAnaGVpZ2h0JzogJ2F1dG8nXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy50ZW1wbGF0ZS5vZmZzZXQoRm91bmRhdGlvbi5Cb3guR2V0T2Zmc2V0cyh0aGlzLnRlbXBsYXRlLCB0aGlzLiRlbGVtZW50LCdjZW50ZXIgJyArIChwb3NpdGlvbiB8fCAnYm90dG9tJyksIHRoaXMub3B0aW9ucy52T2Zmc2V0LCB0aGlzLm9wdGlvbnMuaE9mZnNldCkpO1xyXG5cclxuICAgIHdoaWxlKCFGb3VuZGF0aW9uLkJveC5JbU5vdFRvdWNoaW5nWW91KHRoaXMudGVtcGxhdGUpICYmIHRoaXMuY291bnRlcikge1xyXG4gICAgICB0aGlzLl9yZXBvc2l0aW9uKHBvc2l0aW9uKTtcclxuICAgICAgdGhpcy5fc2V0UG9zaXRpb24oKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIHJldmVhbHMgdGhlIHRvb2x0aXAsIGFuZCBmaXJlcyBhbiBldmVudCB0byBjbG9zZSBhbnkgb3RoZXIgb3BlbiB0b29sdGlwcyBvbiB0aGUgcGFnZVxyXG4gICAqIEBmaXJlcyBUb29sdGlwI2Nsb3NlbWVcclxuICAgKiBAZmlyZXMgVG9vbHRpcCNzaG93XHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgc2hvdygpIHtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuc2hvd09uICE9PSAnYWxsJyAmJiAhRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmlzKHRoaXMub3B0aW9ucy5zaG93T24pKSB7XHJcbiAgICAgIC8vIGNvbnNvbGUuZXJyb3IoJ1RoZSBzY3JlZW4gaXMgdG9vIHNtYWxsIHRvIGRpc3BsYXkgdGhpcyB0b29sdGlwJyk7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy50ZW1wbGF0ZS5jc3MoJ3Zpc2liaWxpdHknLCAnaGlkZGVuJykuc2hvdygpO1xyXG4gICAgdGhpcy5fc2V0UG9zaXRpb24oKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHRvIGNsb3NlIGFsbCBvdGhlciBvcGVuIHRvb2x0aXBzIG9uIHRoZSBwYWdlXHJcbiAgICAgKiBAZXZlbnQgQ2xvc2VtZSN0b29sdGlwXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignY2xvc2VtZS56Zi50b29sdGlwJywgdGhpcy50ZW1wbGF0ZS5hdHRyKCdpZCcpKTtcclxuXHJcblxyXG4gICAgdGhpcy50ZW1wbGF0ZS5hdHRyKHtcclxuICAgICAgJ2RhdGEtaXMtYWN0aXZlJzogdHJ1ZSxcclxuICAgICAgJ2FyaWEtaGlkZGVuJzogZmFsc2VcclxuICAgIH0pO1xyXG4gICAgX3RoaXMuaXNBY3RpdmUgPSB0cnVlO1xyXG4gICAgLy8gY29uc29sZS5sb2codGhpcy50ZW1wbGF0ZSk7XHJcbiAgICB0aGlzLnRlbXBsYXRlLnN0b3AoKS5oaWRlKCkuY3NzKCd2aXNpYmlsaXR5JywgJycpLmZhZGVJbih0aGlzLm9wdGlvbnMuZmFkZUluRHVyYXRpb24sIGZ1bmN0aW9uKCkge1xyXG4gICAgICAvL21heWJlIGRvIHN0dWZmP1xyXG4gICAgfSk7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIHRvb2x0aXAgaXMgc2hvd25cclxuICAgICAqIEBldmVudCBUb29sdGlwI3Nob3dcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdzaG93LnpmLnRvb2x0aXAnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhpZGVzIHRoZSBjdXJyZW50IHRvb2x0aXAsIGFuZCByZXNldHMgdGhlIHBvc2l0aW9uaW5nIGNsYXNzIGlmIGl0IHdhcyBjaGFuZ2VkIGR1ZSB0byBjb2xsaXNpb25cclxuICAgKiBAZmlyZXMgVG9vbHRpcCNoaWRlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgaGlkZSgpIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdoaWRpbmcnLCB0aGlzLiRlbGVtZW50LmRhdGEoJ3lldGktYm94JykpO1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMudGVtcGxhdGUuc3RvcCgpLmF0dHIoe1xyXG4gICAgICAnYXJpYS1oaWRkZW4nOiB0cnVlLFxyXG4gICAgICAnZGF0YS1pcy1hY3RpdmUnOiBmYWxzZVxyXG4gICAgfSkuZmFkZU91dCh0aGlzLm9wdGlvbnMuZmFkZU91dER1cmF0aW9uLCBmdW5jdGlvbigpIHtcclxuICAgICAgX3RoaXMuaXNBY3RpdmUgPSBmYWxzZTtcclxuICAgICAgX3RoaXMuaXNDbGljayA9IGZhbHNlO1xyXG4gICAgICBpZiAoX3RoaXMuY2xhc3NDaGFuZ2VkKSB7XHJcbiAgICAgICAgX3RoaXMudGVtcGxhdGVcclxuICAgICAgICAgICAgIC5yZW1vdmVDbGFzcyhfdGhpcy5fZ2V0UG9zaXRpb25DbGFzcyhfdGhpcy50ZW1wbGF0ZSkpXHJcbiAgICAgICAgICAgICAuYWRkQ2xhc3MoX3RoaXMub3B0aW9ucy5wb3NpdGlvbkNsYXNzKTtcclxuXHJcbiAgICAgICBfdGhpcy51c2VkUG9zaXRpb25zID0gW107XHJcbiAgICAgICBfdGhpcy5jb3VudGVyID0gNDtcclxuICAgICAgIF90aGlzLmNsYXNzQ2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIC8qKlxyXG4gICAgICogZmlyZXMgd2hlbiB0aGUgdG9vbHRpcCBpcyBoaWRkZW5cclxuICAgICAqIEBldmVudCBUb29sdGlwI2hpZGVcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdoaWRlLnpmLnRvb2x0aXAnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIGFkZHMgZXZlbnQgbGlzdGVuZXJzIGZvciB0aGUgdG9vbHRpcCBhbmQgaXRzIGFuY2hvclxyXG4gICAqIFRPRE8gY29tYmluZSBzb21lIG9mIHRoZSBsaXN0ZW5lcnMgbGlrZSBmb2N1cyBhbmQgbW91c2VlbnRlciwgZXRjLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB2YXIgJHRlbXBsYXRlID0gdGhpcy50ZW1wbGF0ZTtcclxuICAgIHZhciBpc0ZvY3VzID0gZmFsc2U7XHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZGlzYWJsZUhvdmVyKSB7XHJcblxyXG4gICAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5vbignbW91c2VlbnRlci56Zi50b29sdGlwJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICghX3RoaXMuaXNBY3RpdmUpIHtcclxuICAgICAgICAgIF90aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBfdGhpcy5zaG93KCk7XHJcbiAgICAgICAgICB9LCBfdGhpcy5vcHRpb25zLmhvdmVyRGVsYXkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLm9uKCdtb3VzZWxlYXZlLnpmLnRvb2x0aXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgIGlmICghaXNGb2N1cyB8fCAoX3RoaXMuaXNDbGljayAmJiAhX3RoaXMub3B0aW9ucy5jbGlja09wZW4pKSB7XHJcbiAgICAgICAgICBfdGhpcy5oaWRlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsaWNrT3Blbikge1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9uKCdtb3VzZWRvd24uemYudG9vbHRpcCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIGlmIChfdGhpcy5pc0NsaWNrKSB7XHJcbiAgICAgICAgICAvL190aGlzLmhpZGUoKTtcclxuICAgICAgICAgIC8vIF90aGlzLmlzQ2xpY2sgPSBmYWxzZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgX3RoaXMuaXNDbGljayA9IHRydWU7XHJcbiAgICAgICAgICBpZiAoKF90aGlzLm9wdGlvbnMuZGlzYWJsZUhvdmVyIHx8ICFfdGhpcy4kZWxlbWVudC5hdHRyKCd0YWJpbmRleCcpKSAmJiAhX3RoaXMuaXNBY3RpdmUpIHtcclxuICAgICAgICAgICAgX3RoaXMuc2hvdygpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9uKCdtb3VzZWRvd24uemYudG9vbHRpcCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIF90aGlzLmlzQ2xpY2sgPSB0cnVlO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5kaXNhYmxlRm9yVG91Y2gpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAub24oJ3RhcC56Zi50b29sdGlwIHRvdWNoZW5kLnpmLnRvb2x0aXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgX3RoaXMuaXNBY3RpdmUgPyBfdGhpcy5oaWRlKCkgOiBfdGhpcy5zaG93KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub24oe1xyXG4gICAgICAvLyAndG9nZ2xlLnpmLnRyaWdnZXInOiB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpLFxyXG4gICAgICAvLyAnY2xvc2UuemYudHJpZ2dlcic6IHRoaXMuaGlkZS5iaW5kKHRoaXMpXHJcbiAgICAgICdjbG9zZS56Zi50cmlnZ2VyJzogdGhpcy5oaWRlLmJpbmQodGhpcylcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLm9uKCdmb2N1cy56Zi50b29sdGlwJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlzRm9jdXMgPSB0cnVlO1xyXG4gICAgICAgIGlmIChfdGhpcy5pc0NsaWNrKSB7XHJcbiAgICAgICAgICAvLyBJZiB3ZSdyZSBub3Qgc2hvd2luZyBvcGVuIG9uIGNsaWNrcywgd2UgbmVlZCB0byBwcmV0ZW5kIGEgY2xpY2stbGF1bmNoZWQgZm9jdXMgaXNuJ3RcclxuICAgICAgICAgIC8vIGEgcmVhbCBmb2N1cywgb3RoZXJ3aXNlIG9uIGhvdmVyIGFuZCBjb21lIGJhY2sgd2UgZ2V0IGJhZCBiZWhhdmlvclxyXG4gICAgICAgICAgaWYoIV90aGlzLm9wdGlvbnMuY2xpY2tPcGVuKSB7IGlzRm9jdXMgPSBmYWxzZTsgfVxyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBfdGhpcy5zaG93KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG5cclxuICAgICAgLm9uKCdmb2N1c291dC56Zi50b29sdGlwJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlzRm9jdXMgPSBmYWxzZTtcclxuICAgICAgICBfdGhpcy5pc0NsaWNrID0gZmFsc2U7XHJcbiAgICAgICAgX3RoaXMuaGlkZSgpO1xyXG4gICAgICB9KVxyXG5cclxuICAgICAgLm9uKCdyZXNpemVtZS56Zi50cmlnZ2VyJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaWYgKF90aGlzLmlzQWN0aXZlKSB7XHJcbiAgICAgICAgICBfdGhpcy5fc2V0UG9zaXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogYWRkcyBhIHRvZ2dsZSBtZXRob2QsIGluIGFkZGl0aW9uIHRvIHRoZSBzdGF0aWMgc2hvdygpICYgaGlkZSgpIGZ1bmN0aW9uc1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHRvZ2dsZSgpIHtcclxuICAgIGlmICh0aGlzLmlzQWN0aXZlKSB7XHJcbiAgICAgIHRoaXMuaGlkZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5zaG93KCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiB0b29sdGlwLCByZW1vdmVzIHRlbXBsYXRlIGVsZW1lbnQgZnJvbSB0aGUgdmlldy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCd0aXRsZScsIHRoaXMudGVtcGxhdGUudGV4dCgpKVxyXG4gICAgICAgICAgICAgICAgIC5vZmYoJy56Zi50cmlnZ2VyIC56Zi50b29sdGlwJylcclxuICAgICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hhcy10aXAgdG9wIHJpZ2h0IGxlZnQnKVxyXG4gICAgICAgICAgICAgICAgIC5yZW1vdmVBdHRyKCdhcmlhLWRlc2NyaWJlZGJ5IGFyaWEtaGFzcG9wdXAgZGF0YS1kaXNhYmxlLWhvdmVyIGRhdGEtcmVzaXplIGRhdGEtdG9nZ2xlIGRhdGEtdG9vbHRpcCBkYXRhLXlldGktYm94Jyk7XHJcblxyXG4gICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmUoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5Ub29sdGlwLmRlZmF1bHRzID0ge1xyXG4gIGRpc2FibGVGb3JUb3VjaDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogVGltZSwgaW4gbXMsIGJlZm9yZSBhIHRvb2x0aXAgc2hvdWxkIG9wZW4gb24gaG92ZXIuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDIwMFxyXG4gICAqL1xyXG4gIGhvdmVyRGVsYXk6IDIwMCxcclxuICAvKipcclxuICAgKiBUaW1lLCBpbiBtcywgYSB0b29sdGlwIHNob3VsZCB0YWtlIHRvIGZhZGUgaW50byB2aWV3LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxNTBcclxuICAgKi9cclxuICBmYWRlSW5EdXJhdGlvbjogMTUwLFxyXG4gIC8qKlxyXG4gICAqIFRpbWUsIGluIG1zLCBhIHRvb2x0aXAgc2hvdWxkIHRha2UgdG8gZmFkZSBvdXQgb2Ygdmlldy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTUwXHJcbiAgICovXHJcbiAgZmFkZU91dER1cmF0aW9uOiAxNTAsXHJcbiAgLyoqXHJcbiAgICogRGlzYWJsZXMgaG92ZXIgZXZlbnRzIGZyb20gb3BlbmluZyB0aGUgdG9vbHRpcCBpZiBzZXQgdG8gdHJ1ZVxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGRpc2FibGVIb3ZlcjogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogT3B0aW9uYWwgYWRkdGlvbmFsIGNsYXNzZXMgdG8gYXBwbHkgdG8gdGhlIHRvb2x0aXAgdGVtcGxhdGUgb24gaW5pdC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ215LWNvb2wtdGlwLWNsYXNzJ1xyXG4gICAqL1xyXG4gIHRlbXBsYXRlQ2xhc3NlczogJycsXHJcbiAgLyoqXHJcbiAgICogTm9uLW9wdGlvbmFsIGNsYXNzIGFkZGVkIHRvIHRvb2x0aXAgdGVtcGxhdGVzLiBGb3VuZGF0aW9uIGRlZmF1bHQgaXMgJ3Rvb2x0aXAnLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAndG9vbHRpcCdcclxuICAgKi9cclxuICB0b29sdGlwQ2xhc3M6ICd0b29sdGlwJyxcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSB0b29sdGlwIGFuY2hvciBlbGVtZW50LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnaGFzLXRpcCdcclxuICAgKi9cclxuICB0cmlnZ2VyQ2xhc3M6ICdoYXMtdGlwJyxcclxuICAvKipcclxuICAgKiBNaW5pbXVtIGJyZWFrcG9pbnQgc2l6ZSBhdCB3aGljaCB0byBvcGVuIHRoZSB0b29sdGlwLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnc21hbGwnXHJcbiAgICovXHJcbiAgc2hvd09uOiAnc21hbGwnLFxyXG4gIC8qKlxyXG4gICAqIEN1c3RvbSB0ZW1wbGF0ZSB0byBiZSB1c2VkIHRvIGdlbmVyYXRlIG1hcmt1cCBmb3IgdG9vbHRpcC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJyZsdDtkaXYgY2xhc3M9XCJ0b29sdGlwXCImZ3Q7Jmx0Oy9kaXYmZ3Q7J1xyXG4gICAqL1xyXG4gIHRlbXBsYXRlOiAnJyxcclxuICAvKipcclxuICAgKiBUZXh0IGRpc3BsYXllZCBpbiB0aGUgdG9vbHRpcCB0ZW1wbGF0ZSBvbiBvcGVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnU29tZSBjb29sIHNwYWNlIGZhY3QgaGVyZS4nXHJcbiAgICovXHJcbiAgdGlwVGV4dDogJycsXHJcbiAgdG91Y2hDbG9zZVRleHQ6ICdUYXAgdG8gY2xvc2UuJyxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHRvb2x0aXAgdG8gcmVtYWluIG9wZW4gaWYgdHJpZ2dlcmVkIHdpdGggYSBjbGljayBvciB0b3VjaCBldmVudC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsaWNrT3BlbjogdHJ1ZSxcclxuICAvKipcclxuICAgKiBBZGRpdGlvbmFsIHBvc2l0aW9uaW5nIGNsYXNzZXMsIHNldCBieSB0aGUgSlNcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3RvcCdcclxuICAgKi9cclxuICBwb3NpdGlvbkNsYXNzOiAnJyxcclxuICAvKipcclxuICAgKiBEaXN0YW5jZSwgaW4gcGl4ZWxzLCB0aGUgdGVtcGxhdGUgc2hvdWxkIHB1c2ggYXdheSBmcm9tIHRoZSBhbmNob3Igb24gdGhlIFkgYXhpcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTBcclxuICAgKi9cclxuICB2T2Zmc2V0OiAxMCxcclxuICAvKipcclxuICAgKiBEaXN0YW5jZSwgaW4gcGl4ZWxzLCB0aGUgdGVtcGxhdGUgc2hvdWxkIHB1c2ggYXdheSBmcm9tIHRoZSBhbmNob3Igb24gdGhlIFggYXhpcywgaWYgYWxpZ25lZCB0byBhIHNpZGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEyXHJcbiAgICovXHJcbiAgaE9mZnNldDogMTIsXHJcbiAgICAvKipcclxuICAgKiBBbGxvdyBIVE1MIGluIHRvb2x0aXAuIFdhcm5pbmc6IElmIHlvdSBhcmUgbG9hZGluZyB1c2VyLWdlbmVyYXRlZCBjb250ZW50IGludG8gdG9vbHRpcHMsXHJcbiAgICogYWxsb3dpbmcgSFRNTCBtYXkgb3BlbiB5b3Vyc2VsZiB1cCB0byBYU1MgYXR0YWNrcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhbGxvd0h0bWw6IGZhbHNlXHJcbn07XHJcblxyXG4vKipcclxuICogVE9ETyB1dGlsaXplIHJlc2l6ZSBldmVudCB0cmlnZ2VyXHJcbiAqL1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oVG9vbHRpcCwgJ1Rvb2x0aXAnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLy8gUG9seWZpbGwgZm9yIHJlcXVlc3RBbmltYXRpb25GcmFtZVxyXG4oZnVuY3Rpb24oKSB7XHJcbiAgaWYgKCFEYXRlLm5vdylcclxuICAgIERhdGUubm93ID0gZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTsgfTtcclxuXHJcbiAgdmFyIHZlbmRvcnMgPSBbJ3dlYmtpdCcsICdtb3onXTtcclxuICBmb3IgKHZhciBpID0gMDsgaSA8IHZlbmRvcnMubGVuZ3RoICYmICF3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lOyArK2kpIHtcclxuICAgICAgdmFyIHZwID0gdmVuZG9yc1tpXTtcclxuICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2cCsnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XHJcbiAgICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9ICh3aW5kb3dbdnArJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfHwgd2luZG93W3ZwKydDYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXSk7XHJcbiAgfVxyXG4gIGlmICgvaVAoYWR8aG9uZXxvZCkuKk9TIDYvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpXHJcbiAgICB8fCAhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAhd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XHJcbiAgICB2YXIgbGFzdFRpbWUgPSAwO1xyXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdmFyIG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgdmFyIG5leHRUaW1lID0gTWF0aC5tYXgobGFzdFRpbWUgKyAxNiwgbm93KTtcclxuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHsgY2FsbGJhY2sobGFzdFRpbWUgPSBuZXh0VGltZSk7IH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFRpbWUgLSBub3cpO1xyXG4gICAgfTtcclxuICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNsZWFyVGltZW91dDtcclxuICB9XHJcbn0pKCk7XHJcblxyXG52YXIgaW5pdENsYXNzZXMgICA9IFsnbXVpLWVudGVyJywgJ211aS1sZWF2ZSddO1xyXG52YXIgYWN0aXZlQ2xhc3NlcyA9IFsnbXVpLWVudGVyLWFjdGl2ZScsICdtdWktbGVhdmUtYWN0aXZlJ107XHJcblxyXG4vLyBGaW5kIHRoZSByaWdodCBcInRyYW5zaXRpb25lbmRcIiBldmVudCBmb3IgdGhpcyBicm93c2VyXHJcbnZhciBlbmRFdmVudCA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgdHJhbnNpdGlvbnMgPSB7XHJcbiAgICAndHJhbnNpdGlvbic6ICd0cmFuc2l0aW9uZW5kJyxcclxuICAgICdXZWJraXRUcmFuc2l0aW9uJzogJ3dlYmtpdFRyYW5zaXRpb25FbmQnLFxyXG4gICAgJ01velRyYW5zaXRpb24nOiAndHJhbnNpdGlvbmVuZCcsXHJcbiAgICAnT1RyYW5zaXRpb24nOiAnb3RyYW5zaXRpb25lbmQnXHJcbiAgfVxyXG4gIHZhciBlbGVtID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cclxuICBmb3IgKHZhciB0IGluIHRyYW5zaXRpb25zKSB7XHJcbiAgICBpZiAodHlwZW9mIGVsZW0uc3R5bGVbdF0gIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybiB0cmFuc2l0aW9uc1t0XTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBudWxsO1xyXG59KSgpO1xyXG5cclxuZnVuY3Rpb24gYW5pbWF0ZShpc0luLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKSB7XHJcbiAgZWxlbWVudCA9ICQoZWxlbWVudCkuZXEoMCk7XHJcblxyXG4gIGlmICghZWxlbWVudC5sZW5ndGgpIHJldHVybjtcclxuXHJcbiAgaWYgKGVuZEV2ZW50ID09PSBudWxsKSB7XHJcbiAgICBpc0luID8gZWxlbWVudC5zaG93KCkgOiBlbGVtZW50LmhpZGUoKTtcclxuICAgIGNiKCk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICB2YXIgaW5pdENsYXNzID0gaXNJbiA/IGluaXRDbGFzc2VzWzBdIDogaW5pdENsYXNzZXNbMV07XHJcbiAgdmFyIGFjdGl2ZUNsYXNzID0gaXNJbiA/IGFjdGl2ZUNsYXNzZXNbMF0gOiBhY3RpdmVDbGFzc2VzWzFdO1xyXG5cclxuICAvLyBTZXQgdXAgdGhlIGFuaW1hdGlvblxyXG4gIHJlc2V0KCk7XHJcbiAgZWxlbWVudC5hZGRDbGFzcyhhbmltYXRpb24pO1xyXG4gIGVsZW1lbnQuY3NzKCd0cmFuc2l0aW9uJywgJ25vbmUnKTtcclxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnVuY3Rpb24oKSB7XHJcbiAgICBlbGVtZW50LmFkZENsYXNzKGluaXRDbGFzcyk7XHJcbiAgICBpZiAoaXNJbikgZWxlbWVudC5zaG93KCk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFN0YXJ0IHRoZSBhbmltYXRpb25cclxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnVuY3Rpb24oKSB7XHJcbiAgICBlbGVtZW50WzBdLm9mZnNldFdpZHRoO1xyXG4gICAgZWxlbWVudC5jc3MoJ3RyYW5zaXRpb24nLCAnJyk7XHJcbiAgICBlbGVtZW50LmFkZENsYXNzKGFjdGl2ZUNsYXNzKTtcclxuICB9KTtcclxuXHJcbiAgLy8gQ2xlYW4gdXAgdGhlIGFuaW1hdGlvbiB3aGVuIGl0IGZpbmlzaGVzXHJcbiAgZWxlbWVudC5vbmUoJ3RyYW5zaXRpb25lbmQnLCBmaW5pc2gpO1xyXG5cclxuICAvLyBIaWRlcyB0aGUgZWxlbWVudCAoZm9yIG91dCBhbmltYXRpb25zKSwgcmVzZXRzIHRoZSBlbGVtZW50LCBhbmQgcnVucyBhIGNhbGxiYWNrXHJcbiAgZnVuY3Rpb24gZmluaXNoKCkge1xyXG4gICAgaWYgKCFpc0luKSBlbGVtZW50LmhpZGUoKTtcclxuICAgIHJlc2V0KCk7XHJcbiAgICBpZiAoY2IpIGNiLmFwcGx5KGVsZW1lbnQpO1xyXG4gIH1cclxuXHJcbiAgLy8gUmVzZXRzIHRyYW5zaXRpb25zIGFuZCByZW1vdmVzIG1vdGlvbi1zcGVjaWZpYyBjbGFzc2VzXHJcbiAgZnVuY3Rpb24gcmVzZXQoKSB7XHJcbiAgICBlbGVtZW50WzBdLnN0eWxlLnRyYW5zaXRpb25EdXJhdGlvbiA9IDA7XHJcbiAgICBlbGVtZW50LnJlbW92ZUNsYXNzKGluaXRDbGFzcyArICcgJyArIGFjdGl2ZUNsYXNzICsgJyAnICsgYW5pbWF0aW9uKTtcclxuICB9XHJcbn1cclxuXHJcbnZhciBNb3Rpb25VSSA9IHtcclxuICBhbmltYXRlSW46IGZ1bmN0aW9uKGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpIHtcclxuICAgIGFuaW1hdGUodHJ1ZSwgZWxlbWVudCwgYW5pbWF0aW9uLCBjYik7XHJcbiAgfSxcclxuXHJcbiAgYW5pbWF0ZU91dDogZnVuY3Rpb24oZWxlbWVudCwgYW5pbWF0aW9uLCBjYikge1xyXG4gICAgYW5pbWF0ZShmYWxzZSwgZWxlbWVudCwgYW5pbWF0aW9uLCBjYik7XHJcbiAgfVxyXG59XHJcbiIsIiQoZnVuY3Rpb24oKSB7XHJcbiAgICAkKHdpbmRvdykuc2Nyb2xsKCBmdW5jdGlvbigpe1xyXG5cclxuXHJcbiAgICAgICAgJCgnLmhpZGVtZScpLmVhY2goIGZ1bmN0aW9uKGkpe1xyXG5cclxuICAgICAgICAgICAgdmFyIGJvdHRvbV9vZl9vYmplY3QgPSAkKHRoaXMpLnBvc2l0aW9uKCkudG9wICsgJCh0aGlzKS5vdXRlckhlaWdodCgpO1xyXG4gICAgICAgICAgICB2YXIgYm90dG9tX29mX3dpbmRvdyA9ICQod2luZG93KS5zY3JvbGxUb3AoKSArICQod2luZG93KS5oZWlnaHQoKTtcclxuXHJcbiAgICAgICAgICAgIC8qIEFkanVzdCB0aGUgXCIyMDBcIiB0byBlaXRoZXIgaGF2ZSBhIGRlbGF5IG9yIHRoYXQgdGhlIGNvbnRlbnQgc3RhcnRzIGZhZGluZyBhIGJpdCBiZWZvcmUgeW91IHJlYWNoIGl0ICAqL1xyXG4gICAgICAgICAgICBib3R0b21fb2Zfd2luZG93ID0gYm90dG9tX29mX3dpbmRvdyArIDUwMDtcclxuXHJcbiAgICAgICAgICAgIGlmKCBib3R0b21fb2Zfd2luZG93ID4gYm90dG9tX29mX29iamVjdCApe1xyXG5cclxuICAgICAgICAgICAgICAgICQodGhpcykuYW5pbWF0ZSh7J29wYWNpdHknOicxJ30sNTAwKTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICB9KTtcclxufSk7XHJcblxyXG4kKHdpbmRvdykuc2Nyb2xsKGZ1bmN0aW9uKCkge1xyXG5cclxuICAvKiBhbmltYXppb25lIHRvcCBtZW51ICovXHJcbiAgaWYoJCh0aGlzKS5zY3JvbGxUb3AoKT41MCl7XHJcbiAgICAgICQoXCIjYmFja3RvdG9wXCIpLmNzcyhcIm9wYWNpdHlcIixcIiAxXCIpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAkKFwiI2JhY2t0b3RvcFwiKS5jc3MoXCJvcGFjaXR5XCIsIFwiMFwiKTtcclxuICB9XHJcblxyXG4gIH0pO1xyXG5cclxuIC8qQXppb25lIEdvVG9wKi9cclxuIGZ1bmN0aW9uIGdvdG9fdG9wKCkge1xyXG4gICAkKCdodG1sLCBib2R5JykuYW5pbWF0ZSh7XHJcbiAgICAgc2Nyb2xsVG9wOiAwXHJcbiAgIH0sMTUwMCk7XHJcbiB9XHJcblxyXG4gLyogQkFDSyBUTyBUT1AgKi9cclxuICQoXCIjYmFja3RvdG9wIGFcIikuY2xpY2soIGZ1bmN0aW9uKCkge1xyXG4gICBnb3RvX3RvcCgpO1xyXG4gfSk7XHJcblxyXG4vKlJvbGwtaG92ZXIgaW1tYWdpbmkgd2lubmVyKi9cblxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG4gICQoJy5zaW5nbGUtZXZlbnQnKS5ob3ZlcihcclxuICAgIGZ1bmN0aW9uKCl7XG5cbiAgICAgICQodGhpcykuZmluZCgnLmNhcHRpb24nKS5mYWRlSW4oMzUwKTtcbiAgICB9LFxuICAgIGZ1bmN0aW9uKCl7XG4gICAgICAkKHRoaXMpLmZpbmQoJy5jYXB0aW9uJykuZmFkZU91dCgyMDApO1xuICAgIH1cbiAgKTtcbn0pO1xyXG5cclxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XHJcbiAgJCgnLnNpbmdsZS1ldmVudDYnKS5ob3ZlcihcclxuICAgIGZ1bmN0aW9uKCl7XHJcblxyXG4gICAgICAkKHRoaXMpLmZpbmQoJy5jYXB0aW9uJykuZmFkZUluKDM1MCk7XHJcbiAgICB9LFxyXG4gICAgZnVuY3Rpb24oKXtcclxuICAgICAgJCh0aGlzKS5maW5kKCcuY2FwdGlvbicpLmZhZGVPdXQoMjAwKTtcclxuICAgIH1cclxuICApO1xyXG59KTtcclxuXHJcbiQod2luZG93KS5zY3JvbGwoZnVuY3Rpb24oKSB7XHJcbiAgaWYoJCh0aGlzKS5zY3JvbGxUb3AoKT41MCl7XHJcbiAgJChcIi5pcy1zdHVja1wiKS5hZGRDbGFzcyhcInNtYWxsZXJcIik7XHJcbiAgJChcIi5pcy1zdHVja1wiKS5yZW1vdmVDbGFzcyhcImJpZ2dlclwiKTtcclxuICAkKFwiLm9yYml0LWltYWdlXCIpLmFkZENsYXNzKFwiZ3JleS1vblwiKTtcclxuXHJcbn0gZWxzZSB7XHJcbiQoXCIuaXMtc3R1Y2tcIikucmVtb3ZlQ2xhc3MoXCJzbWFsbGVyXCIpO1xyXG4kKFwiLnRvcC1iYXJcIikuYWRkQ2xhc3MoXCJiaWdnZXJcIik7XHJcbiQoXCJpbWcub3JiaXQtaW1hZ2VcIikucmVtb3ZlQ2xhc3MoXCJncmV5LW9uXCIpO1xyXG5cclxuIH1cclxuICB9KTtcclxuIiwiXHJcblxyXG4gZnVuY3Rpb24gaW5pdE1hcCgpIHtcclxuICAgLy92YXIgbWFya2VyO1xyXG5cclxuXHQgLy8gQ3JlYXRlIGEgbmV3IFN0eWxlZE1hcFR5cGUgb2JqZWN0LCBwYXNzaW5nIGl0IGFuIGFycmF5IG9mIHN0eWxlcyxcclxuXHQgLy8gYW5kIHRoZSBuYW1lIHRvIGJlIGRpc3BsYXllZCBvbiB0aGUgbWFwIHR5cGUgY29udHJvbC5cclxuXHQgdmFyIHN0eWxlZE1hcFR5cGUgPSBuZXcgZ29vZ2xlLm1hcHMuU3R5bGVkTWFwVHlwZShcclxuXHJcblx0XHRcdFx0IC8qXHJcbiAgICAgICAgIHtlbGVtZW50VHlwZTogJ2dlb21ldHJ5Jywgc3R5bGVyczogW3tjb2xvcjogJyMwMDAwMDAnfV19LFxyXG5cdFx0XHRcdCB7ZWxlbWVudFR5cGU6ICdsYWJlbHMudGV4dC5maWxsJywgc3R5bGVyczogW3tjb2xvcjogJyM1MjM3MzUnfV19LFxyXG5cdFx0XHRcdCB7ZWxlbWVudFR5cGU6ICdsYWJlbHMudGV4dC5zdHJva2UnLCBzdHlsZXJzOiBbe2NvbG9yOiAnI2Y1ZjFlNid9XX0sXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZVwiLFxyXG4gICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeVwiLFxyXG4gICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODA0MDQwXCJcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDA0MFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LnN0cm9rZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjMDAwMDQwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmNvdW50cnlcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiM4MDAwMDBcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwib25cIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmUuY291bnRyeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LnN0cm9rZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODAwMDAwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmNvdW50cnlcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJsYWJlbHMudGV4dFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODA4MDAwXCJcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidmlzaWJpbGl0eVwiOiBcInNpbXBsaWZpZWRcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmUubGFuZF9wYXJjZWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwib25cIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmUubGFuZF9wYXJjZWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5zdHJva2VcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJzaW1wbGlmaWVkXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmxvY2FsaXR5XCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwib2ZmXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmxvY2FsaXR5XCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidmlzaWJpbGl0eVwiOiBcIm9uXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLm5laWdoYm9yaG9vZFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJzaW1wbGlmaWVkXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImxhbmRzY2FwZS5tYW5fbWFkZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzgxODI4NVwiXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInNhdHVyYXRpb25cIjogMjBcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuZXNzXCI6IDQ1XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJsYW5kc2NhcGUubWFuX21hZGVcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5zdHJva2VcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJvblwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJsYW5kc2NhcGUubWFuX21hZGVcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJsYWJlbHMudGV4dC5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJzYXR1cmF0aW9uXCI6IDUwXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImxpZ2h0bmVzc1wiOiAtNDBcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImxhbmRzY2FwZS5uYXR1cmFsXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuc3Ryb2tlXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiM0MDgwODBcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwibGFuZHNjYXBlLm5hdHVyYWwubGFuZGNvdmVyXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwic2F0dXJhdGlvblwiOiAtMjBcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuZXNzXCI6IDEwMFxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwibGFuZHNjYXBlLm5hdHVyYWwudGVycmFpblwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJzaW1wbGlmaWVkXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInBvaS5wYXJrXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwic2F0dXJhdGlvblwiOiAzNVxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogMzVcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInBvaS5wbGFjZV9vZl93b3JzaGlwXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjMDAwMDAwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQuYXJ0ZXJpYWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiNjZmI2M2FcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJzYXR1cmF0aW9uXCI6IDEwMFxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogMjVcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwid2VpZ2h0XCI6IDIuNVxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwicm9hZC5hcnRlcmlhbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LnN0cm9rZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjY2ZiNjNhXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQuaGlnaHdheVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzNjOTRjNFwiXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImxpZ2h0bmVzc1wiOiA0NVxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwicm9hZC5oaWdod2F5LmNvbnRyb2xsZWRfYWNjZXNzXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjZmY4MDAwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQubG9jYWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiNjZmJiNTJcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogNVxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ3ZWlnaHRcIjogNFxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwidHJhbnNpdC5zdGF0aW9uLmJ1c1wiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5XCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiM4MGZmMDBcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwidHJhbnNpdC5zdGF0aW9uLmJ1c1wiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJ0cmFuc2l0LnN0YXRpb24ucmFpbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9XHJcblx0XHRcdCBdLFxyXG5cdFx0XHQge25hbWU6ICdTdHlsZWQgTWFwJ30pO1xyXG5cclxuIHZhciBtYXAgPSBuZXcgZ29vZ2xlLm1hcHMuTWFwKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYXAnKSwge1xyXG5cdCB6b29tOiAxOSxcclxuXHQgY2VudGVyOiB7bGF0OiA0NS40ODEwODg1MDAwMDAwMSwgbG5nOiA5LjIwODg4NjM5OTk5OTk4M31cclxuIH0pO1xyXG5cclxuXHQgbWFwLm1hcFR5cGVzLnNldCgnc3R5bGVkX21hcCcsIHN0eWxlZE1hcFR5cGUpO1xyXG5cdCBtYXAuc2V0TWFwVHlwZUlkKCdzdHlsZWRfbWFwJylcclxuXHJcbiAgIHZhciBpbWFnZSA9ICdodHRwOi8vd3d3LmFydGVuYS5ldS90ZXN0L3dwLWNvbnRlbnQvdGhlbWVzL0ZvdW5kYXRpb25QcmVzcy9hc3NldHMvaW1hZ2VzL21hcmtlci5wbmcnO1xyXG4gICAgIHZhciBiZWFjaE1hcmtlciA9IG5ldyBnb29nbGUubWFwcy5NYXJrZXIoe1xyXG4gICAgICAgcG9zaXRpb246IHtsYXQ6IDQ1LjQ4MTA4ODUwMDAwMDAxLCBsbmc6IDkuMjA4ODg2Mzk5OTk5OTgzfSxcclxuICAgICAgIG1hcDogbWFwLFxyXG4gICAgICAgaWNvbjogaW1hZ2VcclxuICAgICB9KTtcclxuLyogbWFya2VyID0gbmV3IGdvb2dsZS5tYXBzLk1hcmtlcih7XHJcblx0IG1hcDogbWFwLFxyXG5cdCBkcmFnZ2FibGU6IGZhbHNlLFxyXG5cdCBhbmltYXRpb246IGdvb2dsZS5tYXBzLkFuaW1hdGlvbi5EUk9QLFxyXG5cdCB0aXRsZTogJ0FyZ2VudGFyaWEnLFxyXG5cdCBwb3NpdGlvbjoge2xhdDogNDUuNDgxMDg4NTAwMDAwMDEsIGxuZzogOS4yMDg4ODYzOTk5OTk5ODN9XHJcblxyXG5cclxuIH0pO1xyXG4gbWFya2VyLmFkZExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUJvdW5jZSk7Ki9cclxufVxyXG5cclxuXHJcblxyXG5cclxuLypmdW5jdGlvbiB0b2dnbGVCb3VuY2UoKSB7XHJcbmlmIChtYXJrZXIuZ2V0QW5pbWF0aW9uKCkgIT09IG51bGwpIHtcclxubWFya2VyLnNldEFuaW1hdGlvbihudWxsKTtcclxufSBlbHNlIHtcclxubWFya2VyLnNldEFuaW1hdGlvbihnb29nbGUubWFwcy5BbmltYXRpb24uQk9VTkNFKTtcclxufVxyXG59Ki9cclxuIiwialF1ZXJ5KGRvY3VtZW50KS5mb3VuZGF0aW9uKCk7XHJcbiIsIi8vIEpveXJpZGUgZGVtb1xyXG4kKCcjc3RhcnQtanInKS5vbignY2xpY2snLCBmdW5jdGlvbigpIHtcclxuICAkKGRvY3VtZW50KS5mb3VuZGF0aW9uKCdqb3lyaWRlJywnc3RhcnQnKTtcclxufSk7IiwiIiwiJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHZpZGVvcyA9ICQoJ2lmcmFtZVtzcmMqPVwidmltZW8uY29tXCJdLCBpZnJhbWVbc3JjKj1cInlvdXR1YmUuY29tXCJdJyk7XHJcblxyXG4gICAgdmlkZW9zLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBlbCA9ICQodGhpcyk7XHJcbiAgICAgICAgZWwud3JhcCgnPGRpdiBjbGFzcz1cInJlc3BvbnNpdmUtZW1iZWQgd2lkZXNjcmVlblwiLz4nKTtcclxuICAgIH0pO1xyXG59KTtcclxuIiwiXHJcbiQod2luZG93KS5iaW5kKCcgbG9hZCByZXNpemUgb3JpZW50YXRpb25DaGFuZ2UgJywgZnVuY3Rpb24gKCkge1xyXG4gICB2YXIgZm9vdGVyID0gJChcIiNmb290ZXItY29udGFpbmVyXCIpO1xyXG4gICB2YXIgcG9zID0gZm9vdGVyLnBvc2l0aW9uKCk7XHJcbiAgIHZhciBoZWlnaHQgPSAkKHdpbmRvdykuaGVpZ2h0KCk7XHJcbiAgIGhlaWdodCA9IGhlaWdodCAtIHBvcy50b3A7XHJcbiAgIGhlaWdodCA9IGhlaWdodCAtIGZvb3Rlci5oZWlnaHQoKSAtMTtcclxuXHJcbiAgIGZ1bmN0aW9uIHN0aWNreUZvb3RlcigpIHtcclxuICAgICBmb290ZXIuY3NzKHtcclxuICAgICAgICAgJ21hcmdpbi10b3AnOiBoZWlnaHQgKyAncHgnXHJcbiAgICAgfSk7XHJcbiAgIH1cclxuXHJcbiAgIGlmIChoZWlnaHQgPiAwKSB7XHJcbiAgICAgc3RpY2t5Rm9vdGVyKCk7XHJcbiAgIH1cclxufSk7XHJcbiJdfQ==
