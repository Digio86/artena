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

/*Classe menu */
$(window).scroll(function () {
  if ($(this).scrollTop() > 100) {
    $(".is-stuck").addClass("smaller");
    /*$(".is-stuck").removeClass("bigger");*/
  } else {
    $(".is-stuck").removeClass("smaller");
    /*$(".top-bar").addClass("bigger");*/
  }
});

/*Grey imagine*/
$(window).scroll(function () {
  if ($(this).scrollTop() > 500) {
    $(".orbit-image").addClass("grey-on");
  } else {
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
jQuery('#start-jr').on('click', function () {
  jQuery(document).foundation('joyride', 'start');
});
;window.addEventListener("load", function () {
  window.cookieconsent.initialise({
    "palette": {
      "popup": {
        "background": "#000"
      },
      "button": {
        "background": "#cfb53b"
      }
    },
    "content": {
      "message": "Questo sito utilizza cookie, anche di terze parti, per inviarti servizi in linea con le tue preferenze. Se vuoi saperne di più o negare il consenso a tutti o ad alcuni cookie leggi l'informativa estesa sui cookie.",
      "dismiss": "Accetta",
      "link": "Leggi...",
      "href": "http://www.artena.eu/test/cookie-policy/"
    }
  });
});
;jQuery(document).ready(function () {
    var videos = jQuery('iframe[src*="vimeo.com"], iframe[src*="youtube.com"]');

    videos.each(function () {
        var el = jQuery(this);
        el.wrap('<div class="responsive-embed widescreen"/>');
    });
});
;
jQuery(window).bind(' load resize orientationChange ', function () {
   var footer = jQuery("#footer-container");
   var pos = footer.position();
   var height = jQuery(window).height();
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvdW5kYXRpb24uY29yZS5qcyIsImZvdW5kYXRpb24udXRpbC5ib3guanMiLCJmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmQuanMiLCJmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeS5qcyIsImZvdW5kYXRpb24udXRpbC5tb3Rpb24uanMiLCJmb3VuZGF0aW9uLnV0aWwubmVzdC5qcyIsImZvdW5kYXRpb24udXRpbC50aW1lckFuZEltYWdlTG9hZGVyLmpzIiwiZm91bmRhdGlvbi51dGlsLnRvdWNoLmpzIiwiZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzLmpzIiwiZm91bmRhdGlvbi5hYmlkZS5qcyIsImZvdW5kYXRpb24uYWNjb3JkaW9uLmpzIiwiZm91bmRhdGlvbi5hY2NvcmRpb25NZW51LmpzIiwiZm91bmRhdGlvbi5kcmlsbGRvd24uanMiLCJmb3VuZGF0aW9uLmRyb3Bkb3duLmpzIiwiZm91bmRhdGlvbi5kcm9wZG93bk1lbnUuanMiLCJmb3VuZGF0aW9uLmVxdWFsaXplci5qcyIsImZvdW5kYXRpb24uaW50ZXJjaGFuZ2UuanMiLCJmb3VuZGF0aW9uLm1hZ2VsbGFuLmpzIiwiZm91bmRhdGlvbi5vZmZjYW52YXMuanMiLCJmb3VuZGF0aW9uLm9yYml0LmpzIiwiZm91bmRhdGlvbi5yZXNwb25zaXZlTWVudS5qcyIsImZvdW5kYXRpb24ucmVzcG9uc2l2ZVRvZ2dsZS5qcyIsImZvdW5kYXRpb24ucmV2ZWFsLmpzIiwiZm91bmRhdGlvbi5zbGlkZXIuanMiLCJmb3VuZGF0aW9uLnN0aWNreS5qcyIsImZvdW5kYXRpb24udGFicy5qcyIsImZvdW5kYXRpb24udG9nZ2xlci5qcyIsImZvdW5kYXRpb24udG9vbHRpcC5qcyIsIm1vdGlvbi11aS5qcyIsImFydGVuYS5qcyIsImdvb2dsZS1tYXAuanMiLCJpbml0LWZvdW5kYXRpb24uanMiLCJqb3lyaWRlLWRlbW8uanMiLCJwb2xpY3kuanMiLCJyZXNwb25zaXZlLXZpZGVvLmpzIiwic3RpY2t5Zm9vdGVyLmpzIl0sIm5hbWVzIjpbIiQiLCJGT1VOREFUSU9OX1ZFUlNJT04iLCJGb3VuZGF0aW9uIiwidmVyc2lvbiIsIl9wbHVnaW5zIiwiX3V1aWRzIiwicnRsIiwiYXR0ciIsInBsdWdpbiIsIm5hbWUiLCJjbGFzc05hbWUiLCJmdW5jdGlvbk5hbWUiLCJhdHRyTmFtZSIsImh5cGhlbmF0ZSIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luTmFtZSIsImNvbnN0cnVjdG9yIiwidG9Mb3dlckNhc2UiLCJ1dWlkIiwiR2V0WW9EaWdpdHMiLCIkZWxlbWVudCIsImRhdGEiLCJ0cmlnZ2VyIiwicHVzaCIsInVucmVnaXN0ZXJQbHVnaW4iLCJzcGxpY2UiLCJpbmRleE9mIiwicmVtb3ZlQXR0ciIsInJlbW92ZURhdGEiLCJwcm9wIiwicmVJbml0IiwicGx1Z2lucyIsImlzSlEiLCJlYWNoIiwiX2luaXQiLCJ0eXBlIiwiX3RoaXMiLCJmbnMiLCJwbGdzIiwiZm9yRWFjaCIsInAiLCJmb3VuZGF0aW9uIiwiT2JqZWN0Iiwia2V5cyIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsImxlbmd0aCIsIm5hbWVzcGFjZSIsIk1hdGgiLCJyb3VuZCIsInBvdyIsInJhbmRvbSIsInRvU3RyaW5nIiwic2xpY2UiLCJyZWZsb3ciLCJlbGVtIiwiaSIsIiRlbGVtIiwiZmluZCIsImFkZEJhY2siLCIkZWwiLCJvcHRzIiwid2FybiIsInRoaW5nIiwic3BsaXQiLCJlIiwib3B0IiwibWFwIiwiZWwiLCJ0cmltIiwicGFyc2VWYWx1ZSIsImVyIiwiZ2V0Rm5OYW1lIiwidHJhbnNpdGlvbmVuZCIsInRyYW5zaXRpb25zIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiZW5kIiwidCIsInN0eWxlIiwic2V0VGltZW91dCIsInRyaWdnZXJIYW5kbGVyIiwidXRpbCIsInRocm90dGxlIiwiZnVuYyIsImRlbGF5IiwidGltZXIiLCJjb250ZXh0IiwiYXJncyIsImFyZ3VtZW50cyIsImFwcGx5IiwibWV0aG9kIiwiJG1ldGEiLCIkbm9KUyIsImFwcGVuZFRvIiwiaGVhZCIsInJlbW92ZUNsYXNzIiwiTWVkaWFRdWVyeSIsIkFycmF5IiwicHJvdG90eXBlIiwiY2FsbCIsInBsdWdDbGFzcyIsInVuZGVmaW5lZCIsIlJlZmVyZW5jZUVycm9yIiwiVHlwZUVycm9yIiwid2luZG93IiwiZm4iLCJEYXRlIiwibm93IiwiZ2V0VGltZSIsInZlbmRvcnMiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJ2cCIsImNhbmNlbEFuaW1hdGlvbkZyYW1lIiwidGVzdCIsIm5hdmlnYXRvciIsInVzZXJBZ2VudCIsImxhc3RUaW1lIiwiY2FsbGJhY2siLCJuZXh0VGltZSIsIm1heCIsImNsZWFyVGltZW91dCIsInBlcmZvcm1hbmNlIiwic3RhcnQiLCJGdW5jdGlvbiIsImJpbmQiLCJvVGhpcyIsImFBcmdzIiwiZlRvQmluZCIsImZOT1AiLCJmQm91bmQiLCJjb25jYXQiLCJmdW5jTmFtZVJlZ2V4IiwicmVzdWx0cyIsImV4ZWMiLCJzdHIiLCJpc05hTiIsInBhcnNlRmxvYXQiLCJyZXBsYWNlIiwialF1ZXJ5IiwiQm94IiwiSW1Ob3RUb3VjaGluZ1lvdSIsIkdldERpbWVuc2lvbnMiLCJHZXRPZmZzZXRzIiwiZWxlbWVudCIsInBhcmVudCIsImxyT25seSIsInRiT25seSIsImVsZURpbXMiLCJ0b3AiLCJib3R0b20iLCJsZWZ0IiwicmlnaHQiLCJwYXJEaW1zIiwib2Zmc2V0IiwiaGVpZ2h0Iiwid2lkdGgiLCJ3aW5kb3dEaW1zIiwiYWxsRGlycyIsIkVycm9yIiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsInBhclJlY3QiLCJwYXJlbnROb2RlIiwid2luUmVjdCIsImJvZHkiLCJ3aW5ZIiwicGFnZVlPZmZzZXQiLCJ3aW5YIiwicGFnZVhPZmZzZXQiLCJwYXJlbnREaW1zIiwiYW5jaG9yIiwicG9zaXRpb24iLCJ2T2Zmc2V0IiwiaE9mZnNldCIsImlzT3ZlcmZsb3ciLCIkZWxlRGltcyIsIiRhbmNob3JEaW1zIiwia2V5Q29kZXMiLCJjb21tYW5kcyIsIktleWJvYXJkIiwiZ2V0S2V5Q29kZXMiLCJwYXJzZUtleSIsImV2ZW50Iiwia2V5Iiwid2hpY2giLCJrZXlDb2RlIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidG9VcHBlckNhc2UiLCJzaGlmdEtleSIsImN0cmxLZXkiLCJhbHRLZXkiLCJoYW5kbGVLZXkiLCJjb21wb25lbnQiLCJmdW5jdGlvbnMiLCJjb21tYW5kTGlzdCIsImNtZHMiLCJjb21tYW5kIiwibHRyIiwiZXh0ZW5kIiwicmV0dXJuVmFsdWUiLCJoYW5kbGVkIiwidW5oYW5kbGVkIiwiZmluZEZvY3VzYWJsZSIsImZpbHRlciIsImlzIiwicmVnaXN0ZXIiLCJjb21wb25lbnROYW1lIiwidHJhcEZvY3VzIiwiJGZvY3VzYWJsZSIsIiRmaXJzdEZvY3VzYWJsZSIsImVxIiwiJGxhc3RGb2N1c2FibGUiLCJvbiIsInRhcmdldCIsInByZXZlbnREZWZhdWx0IiwiZm9jdXMiLCJyZWxlYXNlRm9jdXMiLCJvZmYiLCJrY3MiLCJrIiwia2MiLCJkZWZhdWx0UXVlcmllcyIsImxhbmRzY2FwZSIsInBvcnRyYWl0IiwicmV0aW5hIiwicXVlcmllcyIsImN1cnJlbnQiLCJzZWxmIiwiZXh0cmFjdGVkU3R5bGVzIiwiY3NzIiwibmFtZWRRdWVyaWVzIiwicGFyc2VTdHlsZVRvT2JqZWN0IiwiaGFzT3duUHJvcGVydHkiLCJ2YWx1ZSIsIl9nZXRDdXJyZW50U2l6ZSIsIl93YXRjaGVyIiwiYXRMZWFzdCIsInNpemUiLCJxdWVyeSIsImdldCIsIm1hdGNoTWVkaWEiLCJtYXRjaGVzIiwibWF0Y2hlZCIsIm5ld1NpemUiLCJjdXJyZW50U2l6ZSIsInN0eWxlTWVkaWEiLCJtZWRpYSIsInNjcmlwdCIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwiaW5mbyIsImlkIiwiaW5zZXJ0QmVmb3JlIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsImN1cnJlbnRTdHlsZSIsIm1hdGNoTWVkaXVtIiwidGV4dCIsInN0eWxlU2hlZXQiLCJjc3NUZXh0IiwidGV4dENvbnRlbnQiLCJzdHlsZU9iamVjdCIsInJlZHVjZSIsInJldCIsInBhcmFtIiwicGFydHMiLCJ2YWwiLCJkZWNvZGVVUklDb21wb25lbnQiLCJpc0FycmF5IiwiaW5pdENsYXNzZXMiLCJhY3RpdmVDbGFzc2VzIiwiTW90aW9uIiwiYW5pbWF0ZUluIiwiYW5pbWF0aW9uIiwiY2IiLCJhbmltYXRlIiwiYW5pbWF0ZU91dCIsIk1vdmUiLCJkdXJhdGlvbiIsImFuaW0iLCJwcm9nIiwibW92ZSIsInRzIiwiaXNJbiIsImluaXRDbGFzcyIsImFjdGl2ZUNsYXNzIiwicmVzZXQiLCJhZGRDbGFzcyIsInNob3ciLCJvZmZzZXRXaWR0aCIsIm9uZSIsImZpbmlzaCIsImhpZGUiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJOZXN0IiwiRmVhdGhlciIsIm1lbnUiLCJpdGVtcyIsInN1Yk1lbnVDbGFzcyIsInN1Ykl0ZW1DbGFzcyIsImhhc1N1YkNsYXNzIiwiJGl0ZW0iLCIkc3ViIiwiY2hpbGRyZW4iLCJCdXJuIiwiVGltZXIiLCJvcHRpb25zIiwibmFtZVNwYWNlIiwicmVtYWluIiwiaXNQYXVzZWQiLCJyZXN0YXJ0IiwiaW5maW5pdGUiLCJwYXVzZSIsIm9uSW1hZ2VzTG9hZGVkIiwiaW1hZ2VzIiwidW5sb2FkZWQiLCJjb21wbGV0ZSIsInJlYWR5U3RhdGUiLCJzaW5nbGVJbWFnZUxvYWRlZCIsInNyYyIsInNwb3RTd2lwZSIsImVuYWJsZWQiLCJkb2N1bWVudEVsZW1lbnQiLCJtb3ZlVGhyZXNob2xkIiwidGltZVRocmVzaG9sZCIsInN0YXJ0UG9zWCIsInN0YXJ0UG9zWSIsInN0YXJ0VGltZSIsImVsYXBzZWRUaW1lIiwiaXNNb3ZpbmciLCJvblRvdWNoRW5kIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm9uVG91Y2hNb3ZlIiwieCIsInRvdWNoZXMiLCJwYWdlWCIsInkiLCJwYWdlWSIsImR4IiwiZHkiLCJkaXIiLCJhYnMiLCJvblRvdWNoU3RhcnQiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5pdCIsInRlYXJkb3duIiwic3BlY2lhbCIsInN3aXBlIiwic2V0dXAiLCJub29wIiwiYWRkVG91Y2giLCJoYW5kbGVUb3VjaCIsImNoYW5nZWRUb3VjaGVzIiwiZmlyc3QiLCJldmVudFR5cGVzIiwidG91Y2hzdGFydCIsInRvdWNobW92ZSIsInRvdWNoZW5kIiwic2ltdWxhdGVkRXZlbnQiLCJNb3VzZUV2ZW50Iiwic2NyZWVuWCIsInNjcmVlblkiLCJjbGllbnRYIiwiY2xpZW50WSIsImNyZWF0ZUV2ZW50IiwiaW5pdE1vdXNlRXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiTXV0YXRpb25PYnNlcnZlciIsInByZWZpeGVzIiwidHJpZ2dlcnMiLCJzdG9wUHJvcGFnYXRpb24iLCJmYWRlT3V0IiwiY2hlY2tMaXN0ZW5lcnMiLCJldmVudHNMaXN0ZW5lciIsInJlc2l6ZUxpc3RlbmVyIiwic2Nyb2xsTGlzdGVuZXIiLCJtdXRhdGVMaXN0ZW5lciIsImNsb3NlbWVMaXN0ZW5lciIsInlldGlCb3hlcyIsInBsdWdOYW1lcyIsImxpc3RlbmVycyIsImpvaW4iLCJwbHVnaW5JZCIsIm5vdCIsImRlYm91bmNlIiwiJG5vZGVzIiwibm9kZXMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGlzdGVuaW5nRWxlbWVudHNNdXRhdGlvbiIsIm11dGF0aW9uUmVjb3Jkc0xpc3QiLCIkdGFyZ2V0IiwiYXR0cmlidXRlTmFtZSIsImNsb3Nlc3QiLCJlbGVtZW50T2JzZXJ2ZXIiLCJvYnNlcnZlIiwiYXR0cmlidXRlcyIsImNoaWxkTGlzdCIsImNoYXJhY3RlckRhdGEiLCJzdWJ0cmVlIiwiYXR0cmlidXRlRmlsdGVyIiwiSUhlYXJZb3UiLCJBYmlkZSIsImRlZmF1bHRzIiwiJGlucHV0cyIsIl9ldmVudHMiLCJyZXNldEZvcm0iLCJ2YWxpZGF0ZUZvcm0iLCJ2YWxpZGF0ZU9uIiwidmFsaWRhdGVJbnB1dCIsImxpdmVWYWxpZGF0ZSIsInZhbGlkYXRlT25CbHVyIiwiX3JlZmxvdyIsInJlcXVpcmVkQ2hlY2siLCJpc0dvb2QiLCJjaGVja2VkIiwiZmluZEZvcm1FcnJvciIsIiRlcnJvciIsInNpYmxpbmdzIiwiZm9ybUVycm9yU2VsZWN0b3IiLCJmaW5kTGFiZWwiLCIkbGFiZWwiLCJmaW5kUmFkaW9MYWJlbHMiLCIkZWxzIiwibGFiZWxzIiwiYWRkRXJyb3JDbGFzc2VzIiwiJGZvcm1FcnJvciIsImxhYmVsRXJyb3JDbGFzcyIsImZvcm1FcnJvckNsYXNzIiwiaW5wdXRFcnJvckNsYXNzIiwicmVtb3ZlUmFkaW9FcnJvckNsYXNzZXMiLCJncm91cE5hbWUiLCIkbGFiZWxzIiwiJGZvcm1FcnJvcnMiLCJyZW1vdmVFcnJvckNsYXNzZXMiLCJjbGVhclJlcXVpcmUiLCJ2YWxpZGF0ZWQiLCJjdXN0b21WYWxpZGF0b3IiLCJ2YWxpZGF0b3IiLCJlcXVhbFRvIiwidmFsaWRhdGVSYWRpbyIsInZhbGlkYXRlVGV4dCIsIm1hdGNoVmFsaWRhdGlvbiIsInZhbGlkYXRvcnMiLCJnb29kVG9HbyIsIm1lc3NhZ2UiLCJkZXBlbmRlbnRFbGVtZW50cyIsImFjYyIsIm5vRXJyb3IiLCJwYXR0ZXJuIiwiaW5wdXRUZXh0IiwidmFsaWQiLCJwYXR0ZXJucyIsIlJlZ0V4cCIsIiRncm91cCIsInJlcXVpcmVkIiwiY2xlYXIiLCJ2IiwiJGZvcm0iLCJkZXN0cm95IiwiYWxwaGEiLCJhbHBoYV9udW1lcmljIiwiaW50ZWdlciIsIm51bWJlciIsImNhcmQiLCJjdnYiLCJlbWFpbCIsInVybCIsImRvbWFpbiIsImRhdGV0aW1lIiwiZGF0ZSIsInRpbWUiLCJkYXRlSVNPIiwibW9udGhfZGF5X3llYXIiLCJkYXlfbW9udGhfeWVhciIsImNvbG9yIiwiQWNjb3JkaW9uIiwiJHRhYnMiLCJpZHgiLCIkY29udGVudCIsImxpbmtJZCIsIiRpbml0QWN0aXZlIiwiZG93biIsIiR0YWJDb250ZW50IiwidG9nZ2xlIiwibmV4dCIsIiRhIiwibXVsdGlFeHBhbmQiLCJwcmV2aW91cyIsInByZXYiLCJoYXNDbGFzcyIsInVwIiwiZmlyc3RUaW1lIiwiJGN1cnJlbnRBY3RpdmUiLCJzbGlkZURvd24iLCJzbGlkZVNwZWVkIiwiJGF1bnRzIiwiYWxsb3dBbGxDbG9zZWQiLCJzbGlkZVVwIiwic3RvcCIsIkFjY29yZGlvbk1lbnUiLCJtdWx0aU9wZW4iLCIkbWVudUxpbmtzIiwic3ViSWQiLCJpc0FjdGl2ZSIsImluaXRQYW5lcyIsIiRzdWJtZW51IiwiJGVsZW1lbnRzIiwiJHByZXZFbGVtZW50IiwiJG5leHRFbGVtZW50IiwibWluIiwicGFyZW50cyIsIm9wZW4iLCJjbG9zZSIsImNsb3NlQWxsIiwiaGlkZUFsbCIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsInNob3dBbGwiLCJwYXJlbnRzVW50aWwiLCJhZGQiLCIkbWVudXMiLCJEcmlsbGRvd24iLCIkc3VibWVudUFuY2hvcnMiLCIkc3VibWVudXMiLCIkbWVudUl0ZW1zIiwiX3ByZXBhcmVNZW51IiwiX3JlZ2lzdGVyRXZlbnRzIiwiX2tleWJvYXJkRXZlbnRzIiwiJGxpbmsiLCJwYXJlbnRMaW5rIiwiY2xvbmUiLCJwcmVwZW5kVG8iLCJ3cmFwIiwiJG1lbnUiLCIkYmFjayIsImJhY2tCdXR0b25Qb3NpdGlvbiIsImFwcGVuZCIsImJhY2tCdXR0b24iLCJwcmVwZW5kIiwiX2JhY2siLCJhdXRvSGVpZ2h0IiwiJHdyYXBwZXIiLCJ3cmFwcGVyIiwiYW5pbWF0ZUhlaWdodCIsIl9nZXRNYXhEaW1zIiwiX3Jlc2l6ZSIsIl9zaG93IiwiY2xvc2VPbkNsaWNrIiwiJGJvZHkiLCJjb250YWlucyIsIl9oaWRlQWxsIiwic2Nyb2xsVG9wIiwiX2JpbmRIYW5kbGVyIiwiX3Njcm9sbFRvcCIsIiRzY3JvbGxUb3BFbGVtZW50Iiwic2Nyb2xsVG9wRWxlbWVudCIsInNjcm9sbFBvcyIsInBhcnNlSW50Iiwic2Nyb2xsVG9wT2Zmc2V0IiwiYW5pbWF0aW9uRHVyYXRpb24iLCJhbmltYXRpb25FYXNpbmciLCJfaGlkZSIsInBhcmVudFN1Yk1lbnUiLCJfbWVudUxpbmtFdmVudHMiLCJibHVyIiwibWF4SGVpZ2h0IiwicmVzdWx0IiwibnVtT2ZFbGVtcyIsInVud3JhcCIsInJlbW92ZSIsIkRyb3Bkb3duIiwiJGlkIiwiJGFuY2hvciIsInBhcmVudENsYXNzIiwiJHBhcmVudCIsInBvc2l0aW9uQ2xhc3MiLCJnZXRQb3NpdGlvbkNsYXNzIiwiY291bnRlciIsInVzZWRQb3NpdGlvbnMiLCJ2ZXJ0aWNhbFBvc2l0aW9uIiwibWF0Y2giLCJob3Jpem9udGFsUG9zaXRpb24iLCJfcmVwb3NpdGlvbiIsImNsYXNzQ2hhbmdlZCIsIl9zZXRQb3NpdGlvbiIsImRpcmVjdGlvbiIsIm5ld1dpZHRoIiwicGFyZW50SE9mZnNldCIsIiRwYXJlbnREaW1zIiwiaG92ZXIiLCJib2R5RGF0YSIsIndoYXRpbnB1dCIsInRpbWVvdXQiLCJob3ZlckRlbGF5IiwiaG92ZXJQYW5lIiwidmlzaWJsZUZvY3VzYWJsZUVsZW1lbnRzIiwiX2FkZEJvZHlIYW5kbGVyIiwiYXV0b0ZvY3VzIiwiY3VyUG9zaXRpb25DbGFzcyIsIkRyb3Bkb3duTWVudSIsInN1YnMiLCJ2ZXJ0aWNhbENsYXNzIiwicmlnaHRDbGFzcyIsImFsaWdubWVudCIsImNoYW5nZWQiLCJfaXNWZXJ0aWNhbCIsImhhc1RvdWNoIiwib250b3VjaHN0YXJ0IiwicGFyQ2xhc3MiLCJoYW5kbGVDbGlja0ZuIiwiaGFzU3ViIiwiaGFzQ2xpY2tlZCIsImNsaWNrT3BlbiIsImZvcmNlRm9sbG93IiwiY2xvc2VPbkNsaWNrSW5zaWRlIiwiZGlzYWJsZUhvdmVyIiwiYXV0b2Nsb3NlIiwiY2xvc2luZ1RpbWUiLCJpc1RhYiIsImluZGV4IiwibmV4dFNpYmxpbmciLCJwcmV2U2libGluZyIsIm9wZW5TdWIiLCJjbG9zZVN1YiIsIiRzaWJzIiwib2xkQ2xhc3MiLCIkcGFyZW50TGkiLCIkdG9DbG9zZSIsInNvbWV0aGluZ1RvQ2xvc2UiLCJFcXVhbGl6ZXIiLCJlcUlkIiwiJHdhdGNoZWQiLCJoYXNOZXN0ZWQiLCJpc05lc3RlZCIsImlzT24iLCJvblJlc2l6ZU1lQm91bmQiLCJfb25SZXNpemVNZSIsIm9uUG9zdEVxdWFsaXplZEJvdW5kIiwiX29uUG9zdEVxdWFsaXplZCIsImltZ3MiLCJ0b29TbWFsbCIsImVxdWFsaXplT24iLCJfY2hlY2tNUSIsIl9wYXVzZUV2ZW50cyIsIl9raWxsc3dpdGNoIiwiZXF1YWxpemVPblN0YWNrIiwiX2lzU3RhY2tlZCIsImVxdWFsaXplQnlSb3ciLCJnZXRIZWlnaHRzQnlSb3ciLCJhcHBseUhlaWdodEJ5Um93IiwiZ2V0SGVpZ2h0cyIsImFwcGx5SGVpZ2h0IiwiaGVpZ2h0cyIsImxlbiIsIm9mZnNldEhlaWdodCIsImxhc3RFbFRvcE9mZnNldCIsImdyb3VwcyIsImdyb3VwIiwiZWxPZmZzZXRUb3AiLCJqIiwibG4iLCJncm91cHNJTGVuZ3RoIiwibGVuSiIsIkludGVyY2hhbmdlIiwicnVsZXMiLCJjdXJyZW50UGF0aCIsIl9hZGRCcmVha3BvaW50cyIsIl9nZW5lcmF0ZVJ1bGVzIiwicnVsZSIsInBhdGgiLCJTUEVDSUFMX1FVRVJJRVMiLCJydWxlc0xpc3QiLCJub2RlTmFtZSIsInJlc3BvbnNlIiwiaHRtbCIsIk1hZ2VsbGFuIiwiY2FsY1BvaW50cyIsIiR0YXJnZXRzIiwiJGxpbmtzIiwiJGFjdGl2ZSIsInBvaW50cyIsIndpbkhlaWdodCIsImlubmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwiZG9jSGVpZ2h0Iiwic2Nyb2xsSGVpZ2h0IiwiJHRhciIsInB0IiwidGhyZXNob2xkIiwidGFyZ2V0UG9pbnQiLCJlYXNpbmciLCJkZWVwTGlua2luZyIsImxvY2F0aW9uIiwiaGFzaCIsInNjcm9sbFRvTG9jIiwiX3VwZGF0ZUFjdGl2ZSIsImFycml2YWwiLCJnZXRBdHRyaWJ1dGUiLCJsb2MiLCJfaW5UcmFuc2l0aW9uIiwiYmFyT2Zmc2V0Iiwid2luUG9zIiwiY3VySWR4IiwiaXNEb3duIiwiY3VyVmlzaWJsZSIsImhpc3RvcnkiLCJwdXNoU3RhdGUiLCJPZmZDYW52YXMiLCIkbGFzdFRyaWdnZXIiLCIkdHJpZ2dlcnMiLCJ0cmFuc2l0aW9uIiwiY29udGVudE92ZXJsYXkiLCJvdmVybGF5Iiwib3ZlcmxheVBvc2l0aW9uIiwic2V0QXR0cmlidXRlIiwiJG92ZXJsYXkiLCJpc1JldmVhbGVkIiwicmV2ZWFsQ2xhc3MiLCJyZXZlYWxPbiIsIl9zZXRNUUNoZWNrZXIiLCJ0cmFuc2l0aW9uVGltZSIsIl9oYW5kbGVLZXlib2FyZCIsInJldmVhbCIsIiRjbG9zZXIiLCJfc3RvcFNjcm9sbGluZyIsImZvcmNlVG8iLCJzY3JvbGxUbyIsImNvbnRlbnRTY3JvbGwiLCJPcmJpdCIsIl9yZXNldCIsImNvbnRhaW5lckNsYXNzIiwiJHNsaWRlcyIsInNsaWRlQ2xhc3MiLCIkaW1hZ2VzIiwiaW5pdEFjdGl2ZSIsInVzZU1VSSIsIl9wcmVwYXJlRm9yT3JiaXQiLCJidWxsZXRzIiwiX2xvYWRCdWxsZXRzIiwiYXV0b1BsYXkiLCJnZW9TeW5jIiwiYWNjZXNzaWJsZSIsIiRidWxsZXRzIiwiYm94T2ZCdWxsZXRzIiwidGltZXJEZWxheSIsImNoYW5nZVNsaWRlIiwiX3NldFdyYXBwZXJIZWlnaHQiLCJ0ZW1wIiwiX3NldFNsaWRlSGVpZ2h0IiwicGF1c2VPbkhvdmVyIiwibmF2QnV0dG9ucyIsIiRjb250cm9scyIsIm5leHRDbGFzcyIsInByZXZDbGFzcyIsIiRzbGlkZSIsIl91cGRhdGVCdWxsZXRzIiwiaXNMVFIiLCJjaG9zZW5TbGlkZSIsIiRjdXJTbGlkZSIsIiRmaXJzdFNsaWRlIiwiJGxhc3RTbGlkZSIsImxhc3QiLCJkaXJJbiIsImRpck91dCIsIiRuZXdTbGlkZSIsImluZmluaXRlV3JhcCIsIiRvbGRCdWxsZXQiLCJzcGFuIiwiZGV0YWNoIiwiJG5ld0J1bGxldCIsImFuaW1JbkZyb21SaWdodCIsImFuaW1PdXRUb1JpZ2h0IiwiYW5pbUluRnJvbUxlZnQiLCJhbmltT3V0VG9MZWZ0IiwiUmVzcG9uc2l2ZU1lbnUiLCJjdXJyZW50TXEiLCJjdXJyZW50UGx1Z2luIiwicnVsZXNUcmVlIiwicnVsZVNpemUiLCJydWxlUGx1Z2luIiwiTWVudVBsdWdpbnMiLCJpc0VtcHR5T2JqZWN0IiwiX2NoZWNrTWVkaWFRdWVyaWVzIiwibWF0Y2hlZE1xIiwiY3NzQ2xhc3MiLCJkcm9wZG93biIsImRyaWxsZG93biIsImFjY29yZGlvbiIsIlJlc3BvbnNpdmVUb2dnbGUiLCJ0YXJnZXRJRCIsIiR0YXJnZXRNZW51IiwiJHRvZ2dsZXIiLCJpbnB1dCIsImFuaW1hdGlvbkluIiwiYW5pbWF0aW9uT3V0IiwiX3VwZGF0ZSIsIl91cGRhdGVNcUhhbmRsZXIiLCJ0b2dnbGVNZW51IiwiaGlkZUZvciIsIlJldmVhbCIsImNhY2hlZCIsIm1xIiwiaXNNb2JpbGUiLCJtb2JpbGVTbmlmZiIsImZ1bGxTY3JlZW4iLCJfbWFrZU92ZXJsYXkiLCJkZWVwTGluayIsIl91cGRhdGVQb3NpdGlvbiIsIm91dGVyV2lkdGgiLCJvdXRlckhlaWdodCIsIm1hcmdpbiIsIl9oYW5kbGVTdGF0ZSIsIm11bHRpcGxlT3BlbmVkIiwiYWRkUmV2ZWFsT3BlbkNsYXNzZXMiLCJvcmlnaW5hbFNjcm9sbFBvcyIsImFmdGVyQW5pbWF0aW9uIiwiZm9jdXNhYmxlRWxlbWVudHMiLCJzaG93RGVsYXkiLCJfZXh0cmFIYW5kbGVycyIsImNsb3NlT25Fc2MiLCJmaW5pc2hVcCIsImhpZGVEZWxheSIsInJlc2V0T25DbG9zZSIsInJlcGxhY2VTdGF0ZSIsInRpdGxlIiwiaHJlZiIsImJ0bU9mZnNldFBjdCIsImlQaG9uZVNuaWZmIiwiYW5kcm9pZFNuaWZmIiwiU2xpZGVyIiwiaW5wdXRzIiwiaGFuZGxlcyIsIiRoYW5kbGUiLCIkaW5wdXQiLCIkZmlsbCIsInZlcnRpY2FsIiwiaXNEYmwiLCJkaXNhYmxlZCIsImRpc2FibGVkQ2xhc3MiLCJiaW5kaW5nIiwiX3NldEluaXRBdHRyIiwiZG91YmxlU2lkZWQiLCIkaGFuZGxlMiIsIiRpbnB1dDIiLCJzZXRIYW5kbGVzIiwiX3NldEhhbmRsZVBvcyIsIl9wY3RPZkJhciIsInBjdE9mQmFyIiwicGVyY2VudCIsInBvc2l0aW9uVmFsdWVGdW5jdGlvbiIsIl9sb2dUcmFuc2Zvcm0iLCJfcG93VHJhbnNmb3JtIiwidG9GaXhlZCIsIl92YWx1ZSIsImJhc2VMb2ciLCJub25MaW5lYXJCYXNlIiwiJGhuZGwiLCJub0ludmVydCIsImgyVmFsIiwic3RlcCIsImgxVmFsIiwidmVydCIsImhPclciLCJsT3JUIiwiaGFuZGxlRGltIiwiZWxlbURpbSIsInB4VG9Nb3ZlIiwibW92ZW1lbnQiLCJkZWNpbWFsIiwiX3NldFZhbHVlcyIsImlzTGVmdEhuZGwiLCJkaW0iLCJoYW5kbGVQY3QiLCJoYW5kbGVQb3MiLCJpbml0aWFsU3RhcnQiLCJtb3ZlVGltZSIsImNoYW5nZWREZWxheSIsImluaXRWYWwiLCJpbml0aWFsRW5kIiwiX2hhbmRsZUV2ZW50IiwiaGFzVmFsIiwiZXZlbnRPZmZzZXQiLCJoYWxmT2ZIYW5kbGUiLCJiYXJEaW0iLCJ3aW5kb3dTY3JvbGwiLCJzY3JvbGxMZWZ0IiwiZWxlbU9mZnNldCIsImV2ZW50RnJvbUJhciIsImJhclhZIiwib2Zmc2V0UGN0IiwiX2FkanVzdFZhbHVlIiwiZmlyc3RIbmRsUG9zIiwiYWJzUG9zaXRpb24iLCJzZWNuZEhuZGxQb3MiLCJkaXYiLCJwcmV2X3ZhbCIsIm5leHRfdmFsIiwiX2V2ZW50c0ZvckhhbmRsZSIsImN1ckhhbmRsZSIsImNsaWNrU2VsZWN0IiwiZHJhZ2dhYmxlIiwiY3VycmVudFRhcmdldCIsIl8kaGFuZGxlIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsImRlY3JlYXNlIiwiaW5jcmVhc2UiLCJkZWNyZWFzZV9mYXN0IiwiaW5jcmVhc2VfZmFzdCIsImludmVydFZlcnRpY2FsIiwiZnJhYyIsIm51bSIsImNsaWNrUG9zIiwiYmFzZSIsImxvZyIsIlN0aWNreSIsIndhc1dyYXBwZWQiLCIkY29udGFpbmVyIiwiY29udGFpbmVyIiwid3JhcElubmVyIiwic3RpY2t5Q2xhc3MiLCJzY3JvbGxDb3VudCIsImNoZWNrRXZlcnkiLCJpc1N0dWNrIiwiY29udGFpbmVySGVpZ2h0IiwiZWxlbUhlaWdodCIsIl9wYXJzZVBvaW50cyIsIl9zZXRTaXplcyIsInNjcm9sbCIsIl9jYWxjIiwiX3JlbW92ZVN0aWNreSIsInRvcFBvaW50IiwicmV2ZXJzZSIsInRvcEFuY2hvciIsImJ0bSIsImJ0bUFuY2hvciIsInB0cyIsImJyZWFrcyIsInBsYWNlIiwiY2FuU3RpY2siLCJfcGF1c2VMaXN0ZW5lcnMiLCJjaGVja1NpemVzIiwiYm90dG9tUG9pbnQiLCJfc2V0U3RpY2t5Iiwic3RpY2tUbyIsIm1yZ24iLCJub3RTdHVja1RvIiwiaXNUb3AiLCJzdGlja1RvVG9wIiwiYW5jaG9yUHQiLCJhbmNob3JIZWlnaHQiLCJ0b3BPckJvdHRvbSIsInN0aWNreU9uIiwibmV3RWxlbVdpZHRoIiwiY29tcCIsInBkbmdsIiwicGRuZ3IiLCJuZXdDb250YWluZXJIZWlnaHQiLCJfc2V0QnJlYWtQb2ludHMiLCJtVG9wIiwiZW1DYWxjIiwibWFyZ2luVG9wIiwibUJ0bSIsIm1hcmdpbkJvdHRvbSIsImVtIiwiZm9udFNpemUiLCJUYWJzIiwiJHRhYlRpdGxlcyIsImxpbmtDbGFzcyIsImxpbmtBY3RpdmVDbGFzcyIsImxvYWQiLCJkZWVwTGlua1NtdWRnZURlbGF5Iiwic2VsZWN0VGFiIiwiZGVlcExpbmtTbXVkZ2UiLCJtYXRjaEhlaWdodCIsIl9zZXRIZWlnaHQiLCJfYWRkS2V5SGFuZGxlciIsIl9hZGRDbGlja0hhbmRsZXIiLCJfc2V0SGVpZ2h0TXFIYW5kbGVyIiwiX2hhbmRsZVRhYkNoYW5nZSIsIndyYXBPbktleXMiLCJhY3RpdmVDb2xsYXBzZSIsIl9jb2xsYXBzZVRhYiIsIiRvbGRUYWIiLCIkdGFiTGluayIsIiR0YXJnZXRDb250ZW50IiwiX29wZW5UYWIiLCJ1cGRhdGVIaXN0b3J5IiwicGFuZWxBY3RpdmVDbGFzcyIsIiR0YXJnZXRfYW5jaG9yIiwiaWRTdHIiLCJwYW5lbENsYXNzIiwicGFuZWwiLCJUb2dnbGVyIiwiX3RvZ2dsZUNsYXNzIiwidG9nZ2xlQ2xhc3MiLCJfdXBkYXRlQVJJQSIsIl90b2dnbGVBbmltYXRlIiwiVG9vbHRpcCIsImlzQ2xpY2siLCJlbGVtSWQiLCJfZ2V0UG9zaXRpb25DbGFzcyIsInRpcFRleHQiLCJ0ZW1wbGF0ZSIsIl9idWlsZFRlbXBsYXRlIiwiYWxsb3dIdG1sIiwidHJpZ2dlckNsYXNzIiwidGVtcGxhdGVDbGFzc2VzIiwidG9vbHRpcENsYXNzIiwiJHRlbXBsYXRlIiwiJHRpcERpbXMiLCJzaG93T24iLCJmYWRlSW4iLCJmYWRlSW5EdXJhdGlvbiIsImZhZGVPdXREdXJhdGlvbiIsImlzRm9jdXMiLCJkaXNhYmxlRm9yVG91Y2giLCJ0b3VjaENsb3NlVGV4dCIsImVuZEV2ZW50IiwiTW90aW9uVUkiLCJib3R0b21fb2Zfb2JqZWN0IiwiYm90dG9tX29mX3dpbmRvdyIsImdvdG9fdG9wIiwiY2xpY2siLCJyZWFkeSIsImluaXRNYXAiLCJzdHlsZWRNYXBUeXBlIiwiZ29vZ2xlIiwibWFwcyIsIlN0eWxlZE1hcFR5cGUiLCJNYXAiLCJnZXRFbGVtZW50QnlJZCIsInpvb20iLCJjZW50ZXIiLCJsYXQiLCJsbmciLCJtYXBUeXBlcyIsInNldCIsInNldE1hcFR5cGVJZCIsImltYWdlIiwiYmVhY2hNYXJrZXIiLCJNYXJrZXIiLCJpY29uIiwiY29va2llY29uc2VudCIsImluaXRpYWxpc2UiLCJ2aWRlb3MiLCJmb290ZXIiLCJwb3MiLCJzdGlja3lGb290ZXIiXSwibWFwcGluZ3MiOiJBQUFBLENBQUMsVUFBU0EsQ0FBVCxFQUFZOztBQUViOztBQUVBLE1BQUlDLHFCQUFxQixPQUF6Qjs7QUFFQTtBQUNBO0FBQ0EsTUFBSUMsYUFBYTtBQUNmQyxhQUFTRixrQkFETTs7QUFHZjs7O0FBR0FHLGNBQVUsRUFOSzs7QUFRZjs7O0FBR0FDLFlBQVEsRUFYTzs7QUFhZjs7O0FBR0FDLFNBQUssWUFBVTtBQUNiLGFBQU9OLEVBQUUsTUFBRixFQUFVTyxJQUFWLENBQWUsS0FBZixNQUEwQixLQUFqQztBQUNELEtBbEJjO0FBbUJmOzs7O0FBSUFDLFlBQVEsVUFBU0EsTUFBVCxFQUFpQkMsSUFBakIsRUFBdUI7QUFDN0I7QUFDQTtBQUNB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TzEzQixNQUFQLEVBQVQsR0FBMEIsQ0FBbkM7O0FBRUEsWUFBUzQzQixZQUFULEdBQXdCO0FBQ3RCRixhQUFPOXlCLEdBQVAsQ0FBVztBQUNQLHVCQUFjNUUsU0FBUztBQURoQixPQUFYO0FBR0Q7O0FBRUQsT0FBSUEsU0FBUyxDQUFiLEVBQWdCO0FBQ2Q0M0I7QUFDRDtBQUNILENBaEJEIiwiZmlsZSI6ImZvdW5kYXRpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyIhZnVuY3Rpb24oJCkge1xyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgRk9VTkRBVElPTl9WRVJTSU9OID0gJzYuMy4wJztcclxuXHJcbi8vIEdsb2JhbCBGb3VuZGF0aW9uIG9iamVjdFxyXG4vLyBUaGlzIGlzIGF0dGFjaGVkIHRvIHRoZSB3aW5kb3csIG9yIHVzZWQgYXMgYSBtb2R1bGUgZm9yIEFNRC9Ccm93c2VyaWZ5XHJcbnZhciBGb3VuZGF0aW9uID0ge1xyXG4gIHZlcnNpb246IEZPVU5EQVRJT05fVkVSU0lPTixcclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcmVzIGluaXRpYWxpemVkIHBsdWdpbnMuXHJcbiAgICovXHJcbiAgX3BsdWdpbnM6IHt9LFxyXG5cclxuICAvKipcclxuICAgKiBTdG9yZXMgZ2VuZXJhdGVkIHVuaXF1ZSBpZHMgZm9yIHBsdWdpbiBpbnN0YW5jZXNcclxuICAgKi9cclxuICBfdXVpZHM6IFtdLFxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm5zIGEgYm9vbGVhbiBmb3IgUlRMIHN1cHBvcnRcclxuICAgKi9cclxuICBydGw6IGZ1bmN0aW9uKCl7XHJcbiAgICByZXR1cm4gJCgnaHRtbCcpLmF0dHIoJ2RpcicpID09PSAncnRsJztcclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIERlZmluZXMgYSBGb3VuZGF0aW9uIHBsdWdpbiwgYWRkaW5nIGl0IHRvIHRoZSBgRm91bmRhdGlvbmAgbmFtZXNwYWNlIGFuZCB0aGUgbGlzdCBvZiBwbHVnaW5zIHRvIGluaXRpYWxpemUgd2hlbiByZWZsb3dpbmcuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IHBsdWdpbiAtIFRoZSBjb25zdHJ1Y3RvciBvZiB0aGUgcGx1Z2luLlxyXG4gICAqL1xyXG4gIHBsdWdpbjogZnVuY3Rpb24ocGx1Z2luLCBuYW1lKSB7XHJcbiAgICAvLyBPYmplY3Qga2V5IHRvIHVzZSB3aGVuIGFkZGluZyB0byBnbG9iYWwgRm91bmRhdGlvbiBvYmplY3RcclxuICAgIC8vIEV4YW1wbGVzOiBGb3VuZGF0aW9uLlJldmVhbCwgRm91bmRhdGlvbi5PZmZDYW52YXNcclxuICAgIHZhciBjbGFzc05hbWUgPSAobmFtZSB8fCBmdW5jdGlvbk5hbWUocGx1Z2luKSk7XHJcbiAgICAvLyBPYmplY3Qga2V5IHRvIHVzZSB3aGVuIHN0b3JpbmcgdGhlIHBsdWdpbiwgYWxzbyB1c2VkIHRvIGNyZWF0ZSB0aGUgaWRlbnRpZnlpbmcgZGF0YSBhdHRyaWJ1dGUgZm9yIHRoZSBwbHVnaW5cclxuICAgIC8vIEV4YW1wbGVzOiBkYXRhLXJldmVhbCwgZGF0YS1vZmYtY2FudmFzXHJcbiAgICB2YXIgYXR0ck5hbWUgID0gaHlwaGVuYXRlKGNsYXNzTmFtZSk7XHJcblxyXG4gICAgLy8gQWRkIHRvIHRoZSBGb3VuZGF0aW9uIG9iamVjdCBhbmQgdGhlIHBsdWdpbnMgbGlzdCAoZm9yIHJlZmxvd2luZylcclxuICAgIHRoaXMuX3BsdWdpbnNbYXR0ck5hbWVdID0gdGhpc1tjbGFzc05hbWVdID0gcGx1Z2luO1xyXG4gIH0sXHJcbiAgLyoqXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogUG9wdWxhdGVzIHRoZSBfdXVpZHMgYXJyYXkgd2l0aCBwb2ludGVycyB0byBlYWNoIGluZGl2aWR1YWwgcGx1Z2luIGluc3RhbmNlLlxyXG4gICAqIEFkZHMgdGhlIGB6ZlBsdWdpbmAgZGF0YS1hdHRyaWJ1dGUgdG8gcHJvZ3JhbW1hdGljYWxseSBjcmVhdGVkIHBsdWdpbnMgdG8gYWxsb3cgdXNlIG9mICQoc2VsZWN0b3IpLmZvdW5kYXRpb24obWV0aG9kKSBjYWxscy5cclxuICAgKiBBbHNvIGZpcmVzIHRoZSBpbml0aWFsaXphdGlvbiBldmVudCBmb3IgZWFjaCBwbHVnaW4sIGNvbnNvbGlkYXRpbmcgcmVwZXRpdGl2ZSBjb2RlLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwbHVnaW4gLSBhbiBpbnN0YW5jZSBvZiBhIHBsdWdpbiwgdXN1YWxseSBgdGhpc2AgaW4gY29udGV4dC5cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIHRoZSBuYW1lIG9mIHRoZSBwbHVnaW4sIHBhc3NlZCBhcyBhIGNhbWVsQ2FzZWQgc3RyaW5nLlxyXG4gICAqIEBmaXJlcyBQbHVnaW4jaW5pdFxyXG4gICAqL1xyXG4gIHJlZ2lzdGVyUGx1Z2luOiBmdW5jdGlvbihwbHVnaW4sIG5hbWUpe1xyXG4gICAgdmFyIHBsdWdpbk5hbWUgPSBuYW1lID8gaHlwaGVuYXRlKG5hbWUpIDogZnVuY3Rpb25OYW1lKHBsdWdpbi5jb25zdHJ1Y3RvcikudG9Mb3dlckNhc2UoKTtcclxuICAgIHBsdWdpbi51dWlkID0gdGhpcy5HZXRZb0RpZ2l0cyg2LCBwbHVnaW5OYW1lKTtcclxuXHJcbiAgICBpZighcGx1Z2luLiRlbGVtZW50LmF0dHIoYGRhdGEtJHtwbHVnaW5OYW1lfWApKXsgcGx1Z2luLiRlbGVtZW50LmF0dHIoYGRhdGEtJHtwbHVnaW5OYW1lfWAsIHBsdWdpbi51dWlkKTsgfVxyXG4gICAgaWYoIXBsdWdpbi4kZWxlbWVudC5kYXRhKCd6ZlBsdWdpbicpKXsgcGx1Z2luLiRlbGVtZW50LmRhdGEoJ3pmUGx1Z2luJywgcGx1Z2luKTsgfVxyXG4gICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBwbHVnaW4gaGFzIGluaXRpYWxpemVkLlxyXG4gICAgICAgICAgICogQGV2ZW50IFBsdWdpbiNpbml0XHJcbiAgICAgICAgICAgKi9cclxuICAgIHBsdWdpbi4kZWxlbWVudC50cmlnZ2VyKGBpbml0LnpmLiR7cGx1Z2luTmFtZX1gKTtcclxuXHJcbiAgICB0aGlzLl91dWlkcy5wdXNoKHBsdWdpbi51dWlkKTtcclxuXHJcbiAgICByZXR1cm47XHJcbiAgfSxcclxuICAvKipcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBSZW1vdmVzIHRoZSBwbHVnaW5zIHV1aWQgZnJvbSB0aGUgX3V1aWRzIGFycmF5LlxyXG4gICAqIFJlbW92ZXMgdGhlIHpmUGx1Z2luIGRhdGEgYXR0cmlidXRlLCBhcyB3ZWxsIGFzIHRoZSBkYXRhLXBsdWdpbi1uYW1lIGF0dHJpYnV0ZS5cclxuICAgKiBBbHNvIGZpcmVzIHRoZSBkZXN0cm95ZWQgZXZlbnQgZm9yIHRoZSBwbHVnaW4sIGNvbnNvbGlkYXRpbmcgcmVwZXRpdGl2ZSBjb2RlLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwbHVnaW4gLSBhbiBpbnN0YW5jZSBvZiBhIHBsdWdpbiwgdXN1YWxseSBgdGhpc2AgaW4gY29udGV4dC5cclxuICAgKiBAZmlyZXMgUGx1Z2luI2Rlc3Ryb3llZFxyXG4gICAqL1xyXG4gIHVucmVnaXN0ZXJQbHVnaW46IGZ1bmN0aW9uKHBsdWdpbil7XHJcbiAgICB2YXIgcGx1Z2luTmFtZSA9IGh5cGhlbmF0ZShmdW5jdGlvbk5hbWUocGx1Z2luLiRlbGVtZW50LmRhdGEoJ3pmUGx1Z2luJykuY29uc3RydWN0b3IpKTtcclxuXHJcbiAgICB0aGlzLl91dWlkcy5zcGxpY2UodGhpcy5fdXVpZHMuaW5kZXhPZihwbHVnaW4udXVpZCksIDEpO1xyXG4gICAgcGx1Z2luLiRlbGVtZW50LnJlbW92ZUF0dHIoYGRhdGEtJHtwbHVnaW5OYW1lfWApLnJlbW92ZURhdGEoJ3pmUGx1Z2luJylcclxuICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgcGx1Z2luIGhhcyBiZWVuIGRlc3Ryb3llZC5cclxuICAgICAgICAgICAqIEBldmVudCBQbHVnaW4jZGVzdHJveWVkXHJcbiAgICAgICAgICAgKi9cclxuICAgICAgICAgIC50cmlnZ2VyKGBkZXN0cm95ZWQuemYuJHtwbHVnaW5OYW1lfWApO1xyXG4gICAgZm9yKHZhciBwcm9wIGluIHBsdWdpbil7XHJcbiAgICAgIHBsdWdpbltwcm9wXSA9IG51bGw7Ly9jbGVhbiB1cCBzY3JpcHQgdG8gcHJlcCBmb3IgZ2FyYmFnZSBjb2xsZWN0aW9uLlxyXG4gICAgfVxyXG4gICAgcmV0dXJuO1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIENhdXNlcyBvbmUgb3IgbW9yZSBhY3RpdmUgcGx1Z2lucyB0byByZS1pbml0aWFsaXplLCByZXNldHRpbmcgZXZlbnQgbGlzdGVuZXJzLCByZWNhbGN1bGF0aW5nIHBvc2l0aW9ucywgZXRjLlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwbHVnaW5zIC0gb3B0aW9uYWwgc3RyaW5nIG9mIGFuIGluZGl2aWR1YWwgcGx1Z2luIGtleSwgYXR0YWluZWQgYnkgY2FsbGluZyBgJChlbGVtZW50KS5kYXRhKCdwbHVnaW5OYW1lJylgLCBvciBzdHJpbmcgb2YgYSBwbHVnaW4gY2xhc3MgaS5lLiBgJ2Ryb3Bkb3duJ2BcclxuICAgKiBAZGVmYXVsdCBJZiBubyBhcmd1bWVudCBpcyBwYXNzZWQsIHJlZmxvdyBhbGwgY3VycmVudGx5IGFjdGl2ZSBwbHVnaW5zLlxyXG4gICAqL1xyXG4gICByZUluaXQ6IGZ1bmN0aW9uKHBsdWdpbnMpe1xyXG4gICAgIHZhciBpc0pRID0gcGx1Z2lucyBpbnN0YW5jZW9mICQ7XHJcbiAgICAgdHJ5e1xyXG4gICAgICAgaWYoaXNKUSl7XHJcbiAgICAgICAgIHBsdWdpbnMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICQodGhpcykuZGF0YSgnemZQbHVnaW4nKS5faW5pdCgpO1xyXG4gICAgICAgICB9KTtcclxuICAgICAgIH1lbHNle1xyXG4gICAgICAgICB2YXIgdHlwZSA9IHR5cGVvZiBwbHVnaW5zLFxyXG4gICAgICAgICBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgIGZucyA9IHtcclxuICAgICAgICAgICAnb2JqZWN0JzogZnVuY3Rpb24ocGxncyl7XHJcbiAgICAgICAgICAgICBwbGdzLmZvckVhY2goZnVuY3Rpb24ocCl7XHJcbiAgICAgICAgICAgICAgIHAgPSBoeXBoZW5hdGUocCk7XHJcbiAgICAgICAgICAgICAgICQoJ1tkYXRhLScrIHAgKyddJykuZm91bmRhdGlvbignX2luaXQnKTtcclxuICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgJ3N0cmluZyc6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICBwbHVnaW5zID0gaHlwaGVuYXRlKHBsdWdpbnMpO1xyXG4gICAgICAgICAgICAgJCgnW2RhdGEtJysgcGx1Z2lucyArJ10nKS5mb3VuZGF0aW9uKCdfaW5pdCcpO1xyXG4gICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgJ3VuZGVmaW5lZCc6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICB0aGlzWydvYmplY3QnXShPYmplY3Qua2V5cyhfdGhpcy5fcGx1Z2lucykpO1xyXG4gICAgICAgICAgIH1cclxuICAgICAgICAgfTtcclxuICAgICAgICAgZm5zW3R5cGVdKHBsdWdpbnMpO1xyXG4gICAgICAgfVxyXG4gICAgIH1jYXRjaChlcnIpe1xyXG4gICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgIH1maW5hbGx5e1xyXG4gICAgICAgcmV0dXJuIHBsdWdpbnM7XHJcbiAgICAgfVxyXG4gICB9LFxyXG5cclxuICAvKipcclxuICAgKiByZXR1cm5zIGEgcmFuZG9tIGJhc2UtMzYgdWlkIHdpdGggbmFtZXNwYWNpbmdcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge051bWJlcn0gbGVuZ3RoIC0gbnVtYmVyIG9mIHJhbmRvbSBiYXNlLTM2IGRpZ2l0cyBkZXNpcmVkLiBJbmNyZWFzZSBmb3IgbW9yZSByYW5kb20gc3RyaW5ncy5cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlIC0gbmFtZSBvZiBwbHVnaW4gdG8gYmUgaW5jb3Jwb3JhdGVkIGluIHVpZCwgb3B0aW9uYWwuXHJcbiAgICogQGRlZmF1bHQge1N0cmluZ30gJycgLSBpZiBubyBwbHVnaW4gbmFtZSBpcyBwcm92aWRlZCwgbm90aGluZyBpcyBhcHBlbmRlZCB0byB0aGUgdWlkLlxyXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IC0gdW5pcXVlIGlkXHJcbiAgICovXHJcbiAgR2V0WW9EaWdpdHM6IGZ1bmN0aW9uKGxlbmd0aCwgbmFtZXNwYWNlKXtcclxuICAgIGxlbmd0aCA9IGxlbmd0aCB8fCA2O1xyXG4gICAgcmV0dXJuIE1hdGgucm91bmQoKE1hdGgucG93KDM2LCBsZW5ndGggKyAxKSAtIE1hdGgucmFuZG9tKCkgKiBNYXRoLnBvdygzNiwgbGVuZ3RoKSkpLnRvU3RyaW5nKDM2KS5zbGljZSgxKSArIChuYW1lc3BhY2UgPyBgLSR7bmFtZXNwYWNlfWAgOiAnJyk7XHJcbiAgfSxcclxuICAvKipcclxuICAgKiBJbml0aWFsaXplIHBsdWdpbnMgb24gYW55IGVsZW1lbnRzIHdpdGhpbiBgZWxlbWAgKGFuZCBgZWxlbWAgaXRzZWxmKSB0aGF0IGFyZW4ndCBhbHJlYWR5IGluaXRpYWxpemVkLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtIC0galF1ZXJ5IG9iamVjdCBjb250YWluaW5nIHRoZSBlbGVtZW50IHRvIGNoZWNrIGluc2lkZS4gQWxzbyBjaGVja3MgdGhlIGVsZW1lbnQgaXRzZWxmLCB1bmxlc3MgaXQncyB0aGUgYGRvY3VtZW50YCBvYmplY3QuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd8QXJyYXl9IHBsdWdpbnMgLSBBIGxpc3Qgb2YgcGx1Z2lucyB0byBpbml0aWFsaXplLiBMZWF2ZSB0aGlzIG91dCB0byBpbml0aWFsaXplIGV2ZXJ5dGhpbmcuXHJcbiAgICovXHJcbiAgcmVmbG93OiBmdW5jdGlvbihlbGVtLCBwbHVnaW5zKSB7XHJcblxyXG4gICAgLy8gSWYgcGx1Z2lucyBpcyB1bmRlZmluZWQsIGp1c3QgZ3JhYiBldmVyeXRoaW5nXHJcbiAgICBpZiAodHlwZW9mIHBsdWdpbnMgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHBsdWdpbnMgPSBPYmplY3Qua2V5cyh0aGlzLl9wbHVnaW5zKTtcclxuICAgIH1cclxuICAgIC8vIElmIHBsdWdpbnMgaXMgYSBzdHJpbmcsIGNvbnZlcnQgaXQgdG8gYW4gYXJyYXkgd2l0aCBvbmUgaXRlbVxyXG4gICAgZWxzZSBpZiAodHlwZW9mIHBsdWdpbnMgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHBsdWdpbnMgPSBbcGx1Z2luc107XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggZWFjaCBwbHVnaW5cclxuICAgICQuZWFjaChwbHVnaW5zLCBmdW5jdGlvbihpLCBuYW1lKSB7XHJcbiAgICAgIC8vIEdldCB0aGUgY3VycmVudCBwbHVnaW5cclxuICAgICAgdmFyIHBsdWdpbiA9IF90aGlzLl9wbHVnaW5zW25hbWVdO1xyXG5cclxuICAgICAgLy8gTG9jYWxpemUgdGhlIHNlYXJjaCB0byBhbGwgZWxlbWVudHMgaW5zaWRlIGVsZW0sIGFzIHdlbGwgYXMgZWxlbSBpdHNlbGYsIHVubGVzcyBlbGVtID09PSBkb2N1bWVudFxyXG4gICAgICB2YXIgJGVsZW0gPSAkKGVsZW0pLmZpbmQoJ1tkYXRhLScrbmFtZSsnXScpLmFkZEJhY2soJ1tkYXRhLScrbmFtZSsnXScpO1xyXG5cclxuICAgICAgLy8gRm9yIGVhY2ggcGx1Z2luIGZvdW5kLCBpbml0aWFsaXplIGl0XHJcbiAgICAgICRlbGVtLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyICRlbCA9ICQodGhpcyksXHJcbiAgICAgICAgICAgIG9wdHMgPSB7fTtcclxuICAgICAgICAvLyBEb24ndCBkb3VibGUtZGlwIG9uIHBsdWdpbnNcclxuICAgICAgICBpZiAoJGVsLmRhdGEoJ3pmUGx1Z2luJykpIHtcclxuICAgICAgICAgIGNvbnNvbGUud2FybihcIlRyaWVkIHRvIGluaXRpYWxpemUgXCIrbmFtZStcIiBvbiBhbiBlbGVtZW50IHRoYXQgYWxyZWFkeSBoYXMgYSBGb3VuZGF0aW9uIHBsdWdpbi5cIik7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZigkZWwuYXR0cignZGF0YS1vcHRpb25zJykpe1xyXG4gICAgICAgICAgdmFyIHRoaW5nID0gJGVsLmF0dHIoJ2RhdGEtb3B0aW9ucycpLnNwbGl0KCc7JykuZm9yRWFjaChmdW5jdGlvbihlLCBpKXtcclxuICAgICAgICAgICAgdmFyIG9wdCA9IGUuc3BsaXQoJzonKS5tYXAoZnVuY3Rpb24oZWwpeyByZXR1cm4gZWwudHJpbSgpOyB9KTtcclxuICAgICAgICAgICAgaWYob3B0WzBdKSBvcHRzW29wdFswXV0gPSBwYXJzZVZhbHVlKG9wdFsxXSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdHJ5e1xyXG4gICAgICAgICAgJGVsLmRhdGEoJ3pmUGx1Z2luJywgbmV3IHBsdWdpbigkKHRoaXMpLCBvcHRzKSk7XHJcbiAgICAgICAgfWNhdGNoKGVyKXtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXIpO1xyXG4gICAgICAgIH1maW5hbGx5e1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9LFxyXG4gIGdldEZuTmFtZTogZnVuY3Rpb25OYW1lLFxyXG4gIHRyYW5zaXRpb25lbmQ6IGZ1bmN0aW9uKCRlbGVtKXtcclxuICAgIHZhciB0cmFuc2l0aW9ucyA9IHtcclxuICAgICAgJ3RyYW5zaXRpb24nOiAndHJhbnNpdGlvbmVuZCcsXHJcbiAgICAgICdXZWJraXRUcmFuc2l0aW9uJzogJ3dlYmtpdFRyYW5zaXRpb25FbmQnLFxyXG4gICAgICAnTW96VHJhbnNpdGlvbic6ICd0cmFuc2l0aW9uZW5kJyxcclxuICAgICAgJ09UcmFuc2l0aW9uJzogJ290cmFuc2l0aW9uZW5kJ1xyXG4gICAgfTtcclxuICAgIHZhciBlbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgICAgZW5kO1xyXG5cclxuICAgIGZvciAodmFyIHQgaW4gdHJhbnNpdGlvbnMpe1xyXG4gICAgICBpZiAodHlwZW9mIGVsZW0uc3R5bGVbdF0gIT09ICd1bmRlZmluZWQnKXtcclxuICAgICAgICBlbmQgPSB0cmFuc2l0aW9uc1t0XTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYoZW5kKXtcclxuICAgICAgcmV0dXJuIGVuZDtcclxuICAgIH1lbHNle1xyXG4gICAgICBlbmQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgJGVsZW0udHJpZ2dlckhhbmRsZXIoJ3RyYW5zaXRpb25lbmQnLCBbJGVsZW1dKTtcclxuICAgICAgfSwgMSk7XHJcbiAgICAgIHJldHVybiAndHJhbnNpdGlvbmVuZCc7XHJcbiAgICB9XHJcbiAgfVxyXG59O1xyXG5cclxuRm91bmRhdGlvbi51dGlsID0ge1xyXG4gIC8qKlxyXG4gICAqIEZ1bmN0aW9uIGZvciBhcHBseWluZyBhIGRlYm91bmNlIGVmZmVjdCB0byBhIGZ1bmN0aW9uIGNhbGwuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyAtIEZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBhdCBlbmQgb2YgdGltZW91dC5cclxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsYXkgLSBUaW1lIGluIG1zIHRvIGRlbGF5IHRoZSBjYWxsIG9mIGBmdW5jYC5cclxuICAgKiBAcmV0dXJucyBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHRocm90dGxlOiBmdW5jdGlvbiAoZnVuYywgZGVsYXkpIHtcclxuICAgIHZhciB0aW1lciA9IG51bGw7XHJcblxyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcclxuICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzO1xyXG5cclxuICAgICAgaWYgKHRpbWVyID09PSBudWxsKSB7XHJcbiAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XHJcbiAgICAgICAgICB0aW1lciA9IG51bGw7XHJcbiAgICAgICAgfSwgZGVsYXkpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH1cclxufTtcclxuXHJcbi8vIFRPRE86IGNvbnNpZGVyIG5vdCBtYWtpbmcgdGhpcyBhIGpRdWVyeSBmdW5jdGlvblxyXG4vLyBUT0RPOiBuZWVkIHdheSB0byByZWZsb3cgdnMuIHJlLWluaXRpYWxpemVcclxuLyoqXHJcbiAqIFRoZSBGb3VuZGF0aW9uIGpRdWVyeSBtZXRob2QuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fSBtZXRob2QgLSBBbiBhY3Rpb24gdG8gcGVyZm9ybSBvbiB0aGUgY3VycmVudCBqUXVlcnkgb2JqZWN0LlxyXG4gKi9cclxudmFyIGZvdW5kYXRpb24gPSBmdW5jdGlvbihtZXRob2QpIHtcclxuICB2YXIgdHlwZSA9IHR5cGVvZiBtZXRob2QsXHJcbiAgICAgICRtZXRhID0gJCgnbWV0YS5mb3VuZGF0aW9uLW1xJyksXHJcbiAgICAgICRub0pTID0gJCgnLm5vLWpzJyk7XHJcblxyXG4gIGlmKCEkbWV0YS5sZW5ndGgpe1xyXG4gICAgJCgnPG1ldGEgY2xhc3M9XCJmb3VuZGF0aW9uLW1xXCI+JykuYXBwZW5kVG8oZG9jdW1lbnQuaGVhZCk7XHJcbiAgfVxyXG4gIGlmKCRub0pTLmxlbmd0aCl7XHJcbiAgICAkbm9KUy5yZW1vdmVDbGFzcygnbm8tanMnKTtcclxuICB9XHJcblxyXG4gIGlmKHR5cGUgPT09ICd1bmRlZmluZWQnKXsvL25lZWRzIHRvIGluaXRpYWxpemUgdGhlIEZvdW5kYXRpb24gb2JqZWN0LCBvciBhbiBpbmRpdmlkdWFsIHBsdWdpbi5cclxuICAgIEZvdW5kYXRpb24uTWVkaWFRdWVyeS5faW5pdCgpO1xyXG4gICAgRm91bmRhdGlvbi5yZWZsb3codGhpcyk7XHJcbiAgfWVsc2UgaWYodHlwZSA9PT0gJ3N0cmluZycpey8vYW4gaW5kaXZpZHVhbCBtZXRob2QgdG8gaW52b2tlIG9uIGEgcGx1Z2luIG9yIGdyb3VwIG9mIHBsdWdpbnNcclxuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTsvL2NvbGxlY3QgYWxsIHRoZSBhcmd1bWVudHMsIGlmIG5lY2Vzc2FyeVxyXG4gICAgdmFyIHBsdWdDbGFzcyA9IHRoaXMuZGF0YSgnemZQbHVnaW4nKTsvL2RldGVybWluZSB0aGUgY2xhc3Mgb2YgcGx1Z2luXHJcblxyXG4gICAgaWYocGx1Z0NsYXNzICE9PSB1bmRlZmluZWQgJiYgcGx1Z0NsYXNzW21ldGhvZF0gIT09IHVuZGVmaW5lZCl7Ly9tYWtlIHN1cmUgYm90aCB0aGUgY2xhc3MgYW5kIG1ldGhvZCBleGlzdFxyXG4gICAgICBpZih0aGlzLmxlbmd0aCA9PT0gMSl7Ly9pZiB0aGVyZSdzIG9ubHkgb25lLCBjYWxsIGl0IGRpcmVjdGx5LlxyXG4gICAgICAgICAgcGx1Z0NsYXNzW21ldGhvZF0uYXBwbHkocGx1Z0NsYXNzLCBhcmdzKTtcclxuICAgICAgfWVsc2V7XHJcbiAgICAgICAgdGhpcy5lYWNoKGZ1bmN0aW9uKGksIGVsKXsvL290aGVyd2lzZSBsb29wIHRocm91Z2ggdGhlIGpRdWVyeSBjb2xsZWN0aW9uIGFuZCBpbnZva2UgdGhlIG1ldGhvZCBvbiBlYWNoXHJcbiAgICAgICAgICBwbHVnQ2xhc3NbbWV0aG9kXS5hcHBseSgkKGVsKS5kYXRhKCd6ZlBsdWdpbicpLCBhcmdzKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfWVsc2V7Ly9lcnJvciBmb3Igbm8gY2xhc3Mgb3Igbm8gbWV0aG9kXHJcbiAgICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcIldlJ3JlIHNvcnJ5LCAnXCIgKyBtZXRob2QgKyBcIicgaXMgbm90IGFuIGF2YWlsYWJsZSBtZXRob2QgZm9yIFwiICsgKHBsdWdDbGFzcyA/IGZ1bmN0aW9uTmFtZShwbHVnQ2xhc3MpIDogJ3RoaXMgZWxlbWVudCcpICsgJy4nKTtcclxuICAgIH1cclxuICB9ZWxzZXsvL2Vycm9yIGZvciBpbnZhbGlkIGFyZ3VtZW50IHR5cGVcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFdlJ3JlIHNvcnJ5LCAke3R5cGV9IGlzIG5vdCBhIHZhbGlkIHBhcmFtZXRlci4gWW91IG11c3QgdXNlIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgbWV0aG9kIHlvdSB3aXNoIHRvIGludm9rZS5gKTtcclxuICB9XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG53aW5kb3cuRm91bmRhdGlvbiA9IEZvdW5kYXRpb247XHJcbiQuZm4uZm91bmRhdGlvbiA9IGZvdW5kYXRpb247XHJcblxyXG4vLyBQb2x5ZmlsbCBmb3IgcmVxdWVzdEFuaW1hdGlvbkZyYW1lXHJcbihmdW5jdGlvbigpIHtcclxuICBpZiAoIURhdGUubm93IHx8ICF3aW5kb3cuRGF0ZS5ub3cpXHJcbiAgICB3aW5kb3cuRGF0ZS5ub3cgPSBEYXRlLm5vdyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7IH07XHJcblxyXG4gIHZhciB2ZW5kb3JzID0gWyd3ZWJraXQnLCAnbW96J107XHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB2ZW5kb3JzLmxlbmd0aCAmJiAhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZTsgKytpKSB7XHJcbiAgICAgIHZhciB2cCA9IHZlbmRvcnNbaV07XHJcbiAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdnArJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xyXG4gICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSAod2luZG93W3ZwKydDYW5jZWxBbmltYXRpb25GcmFtZSddXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHx8IHdpbmRvd1t2cCsnQ2FuY2VsUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ10pO1xyXG4gIH1cclxuICBpZiAoL2lQKGFkfGhvbmV8b2QpLipPUyA2Ly50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KVxyXG4gICAgfHwgIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgIXdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSkge1xyXG4gICAgdmFyIGxhc3RUaW1lID0gMDtcclxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgIHZhciBuZXh0VGltZSA9IE1hdGgubWF4KGxhc3RUaW1lICsgMTYsIG5vdyk7XHJcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGNhbGxiYWNrKGxhc3RUaW1lID0gbmV4dFRpbWUpOyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRUaW1lIC0gbm93KTtcclxuICAgIH07XHJcbiAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjbGVhclRpbWVvdXQ7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIFBvbHlmaWxsIGZvciBwZXJmb3JtYW5jZS5ub3csIHJlcXVpcmVkIGJ5IHJBRlxyXG4gICAqL1xyXG4gIGlmKCF3aW5kb3cucGVyZm9ybWFuY2UgfHwgIXdpbmRvdy5wZXJmb3JtYW5jZS5ub3cpe1xyXG4gICAgd2luZG93LnBlcmZvcm1hbmNlID0ge1xyXG4gICAgICBzdGFydDogRGF0ZS5ub3coKSxcclxuICAgICAgbm93OiBmdW5jdGlvbigpeyByZXR1cm4gRGF0ZS5ub3coKSAtIHRoaXMuc3RhcnQ7IH1cclxuICAgIH07XHJcbiAgfVxyXG59KSgpO1xyXG5pZiAoIUZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kKSB7XHJcbiAgRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbihvVGhpcykge1xyXG4gICAgaWYgKHR5cGVvZiB0aGlzICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIC8vIGNsb3Nlc3QgdGhpbmcgcG9zc2libGUgdG8gdGhlIEVDTUFTY3JpcHQgNVxyXG4gICAgICAvLyBpbnRlcm5hbCBJc0NhbGxhYmxlIGZ1bmN0aW9uXHJcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Z1bmN0aW9uLnByb3RvdHlwZS5iaW5kIC0gd2hhdCBpcyB0cnlpbmcgdG8gYmUgYm91bmQgaXMgbm90IGNhbGxhYmxlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGFBcmdzICAgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxyXG4gICAgICAgIGZUb0JpbmQgPSB0aGlzLFxyXG4gICAgICAgIGZOT1AgICAgPSBmdW5jdGlvbigpIHt9LFxyXG4gICAgICAgIGZCb3VuZCAgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIHJldHVybiBmVG9CaW5kLmFwcGx5KHRoaXMgaW5zdGFuY2VvZiBmTk9QXHJcbiAgICAgICAgICAgICAgICAgPyB0aGlzXHJcbiAgICAgICAgICAgICAgICAgOiBvVGhpcyxcclxuICAgICAgICAgICAgICAgICBhQXJncy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgaWYgKHRoaXMucHJvdG90eXBlKSB7XHJcbiAgICAgIC8vIG5hdGl2ZSBmdW5jdGlvbnMgZG9uJ3QgaGF2ZSBhIHByb3RvdHlwZVxyXG4gICAgICBmTk9QLnByb3RvdHlwZSA9IHRoaXMucHJvdG90eXBlO1xyXG4gICAgfVxyXG4gICAgZkJvdW5kLnByb3RvdHlwZSA9IG5ldyBmTk9QKCk7XHJcblxyXG4gICAgcmV0dXJuIGZCb3VuZDtcclxuICB9O1xyXG59XHJcbi8vIFBvbHlmaWxsIHRvIGdldCB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uIGluIElFOVxyXG5mdW5jdGlvbiBmdW5jdGlvbk5hbWUoZm4pIHtcclxuICBpZiAoRnVuY3Rpb24ucHJvdG90eXBlLm5hbWUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgdmFyIGZ1bmNOYW1lUmVnZXggPSAvZnVuY3Rpb25cXHMoW14oXXsxLH0pXFwoLztcclxuICAgIHZhciByZXN1bHRzID0gKGZ1bmNOYW1lUmVnZXgpLmV4ZWMoKGZuKS50b1N0cmluZygpKTtcclxuICAgIHJldHVybiAocmVzdWx0cyAmJiByZXN1bHRzLmxlbmd0aCA+IDEpID8gcmVzdWx0c1sxXS50cmltKCkgOiBcIlwiO1xyXG4gIH1cclxuICBlbHNlIGlmIChmbi5wcm90b3R5cGUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuIGZuLmNvbnN0cnVjdG9yLm5hbWU7XHJcbiAgfVxyXG4gIGVsc2Uge1xyXG4gICAgcmV0dXJuIGZuLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5uYW1lO1xyXG4gIH1cclxufVxyXG5mdW5jdGlvbiBwYXJzZVZhbHVlKHN0cil7XHJcbiAgaWYgKCd0cnVlJyA9PT0gc3RyKSByZXR1cm4gdHJ1ZTtcclxuICBlbHNlIGlmICgnZmFsc2UnID09PSBzdHIpIHJldHVybiBmYWxzZTtcclxuICBlbHNlIGlmICghaXNOYU4oc3RyICogMSkpIHJldHVybiBwYXJzZUZsb2F0KHN0cik7XHJcbiAgcmV0dXJuIHN0cjtcclxufVxyXG4vLyBDb252ZXJ0IFBhc2NhbENhc2UgdG8ga2ViYWItY2FzZVxyXG4vLyBUaGFuayB5b3U6IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzg5NTU1ODBcclxuZnVuY3Rpb24gaHlwaGVuYXRlKHN0cikge1xyXG4gIHJldHVybiBzdHIucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxLSQyJykudG9Mb3dlckNhc2UoKTtcclxufVxyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuRm91bmRhdGlvbi5Cb3ggPSB7XHJcbiAgSW1Ob3RUb3VjaGluZ1lvdTogSW1Ob3RUb3VjaGluZ1lvdSxcclxuICBHZXREaW1lbnNpb25zOiBHZXREaW1lbnNpb25zLFxyXG4gIEdldE9mZnNldHM6IEdldE9mZnNldHNcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBhcmVzIHRoZSBkaW1lbnNpb25zIG9mIGFuIGVsZW1lbnQgdG8gYSBjb250YWluZXIgYW5kIGRldGVybWluZXMgY29sbGlzaW9uIGV2ZW50cyB3aXRoIGNvbnRhaW5lci5cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byB0ZXN0IGZvciBjb2xsaXNpb25zLlxyXG4gKiBAcGFyYW0ge2pRdWVyeX0gcGFyZW50IC0galF1ZXJ5IG9iamVjdCB0byB1c2UgYXMgYm91bmRpbmcgY29udGFpbmVyLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGxyT25seSAtIHNldCB0byB0cnVlIHRvIGNoZWNrIGxlZnQgYW5kIHJpZ2h0IHZhbHVlcyBvbmx5LlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHRiT25seSAtIHNldCB0byB0cnVlIHRvIGNoZWNrIHRvcCBhbmQgYm90dG9tIHZhbHVlcyBvbmx5LlxyXG4gKiBAZGVmYXVsdCBpZiBubyBwYXJlbnQgb2JqZWN0IHBhc3NlZCwgZGV0ZWN0cyBjb2xsaXNpb25zIHdpdGggYHdpbmRvd2AuXHJcbiAqIEByZXR1cm5zIHtCb29sZWFufSAtIHRydWUgaWYgY29sbGlzaW9uIGZyZWUsIGZhbHNlIGlmIGEgY29sbGlzaW9uIGluIGFueSBkaXJlY3Rpb24uXHJcbiAqL1xyXG5mdW5jdGlvbiBJbU5vdFRvdWNoaW5nWW91KGVsZW1lbnQsIHBhcmVudCwgbHJPbmx5LCB0Yk9ubHkpIHtcclxuICB2YXIgZWxlRGltcyA9IEdldERpbWVuc2lvbnMoZWxlbWVudCksXHJcbiAgICAgIHRvcCwgYm90dG9tLCBsZWZ0LCByaWdodDtcclxuXHJcbiAgaWYgKHBhcmVudCkge1xyXG4gICAgdmFyIHBhckRpbXMgPSBHZXREaW1lbnNpb25zKHBhcmVudCk7XHJcblxyXG4gICAgYm90dG9tID0gKGVsZURpbXMub2Zmc2V0LnRvcCArIGVsZURpbXMuaGVpZ2h0IDw9IHBhckRpbXMuaGVpZ2h0ICsgcGFyRGltcy5vZmZzZXQudG9wKTtcclxuICAgIHRvcCAgICA9IChlbGVEaW1zLm9mZnNldC50b3AgPj0gcGFyRGltcy5vZmZzZXQudG9wKTtcclxuICAgIGxlZnQgICA9IChlbGVEaW1zLm9mZnNldC5sZWZ0ID49IHBhckRpbXMub2Zmc2V0LmxlZnQpO1xyXG4gICAgcmlnaHQgID0gKGVsZURpbXMub2Zmc2V0LmxlZnQgKyBlbGVEaW1zLndpZHRoIDw9IHBhckRpbXMud2lkdGggKyBwYXJEaW1zLm9mZnNldC5sZWZ0KTtcclxuICB9XHJcbiAgZWxzZSB7XHJcbiAgICBib3R0b20gPSAoZWxlRGltcy5vZmZzZXQudG9wICsgZWxlRGltcy5oZWlnaHQgPD0gZWxlRGltcy53aW5kb3dEaW1zLmhlaWdodCArIGVsZURpbXMud2luZG93RGltcy5vZmZzZXQudG9wKTtcclxuICAgIHRvcCAgICA9IChlbGVEaW1zLm9mZnNldC50b3AgPj0gZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC50b3ApO1xyXG4gICAgbGVmdCAgID0gKGVsZURpbXMub2Zmc2V0LmxlZnQgPj0gZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC5sZWZ0KTtcclxuICAgIHJpZ2h0ICA9IChlbGVEaW1zLm9mZnNldC5sZWZ0ICsgZWxlRGltcy53aWR0aCA8PSBlbGVEaW1zLndpbmRvd0RpbXMud2lkdGgpO1xyXG4gIH1cclxuXHJcbiAgdmFyIGFsbERpcnMgPSBbYm90dG9tLCB0b3AsIGxlZnQsIHJpZ2h0XTtcclxuXHJcbiAgaWYgKGxyT25seSkge1xyXG4gICAgcmV0dXJuIGxlZnQgPT09IHJpZ2h0ID09PSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgaWYgKHRiT25seSkge1xyXG4gICAgcmV0dXJuIHRvcCA9PT0gYm90dG9tID09PSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGFsbERpcnMuaW5kZXhPZihmYWxzZSkgPT09IC0xO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFVzZXMgbmF0aXZlIG1ldGhvZHMgdG8gcmV0dXJuIGFuIG9iamVjdCBvZiBkaW1lbnNpb24gdmFsdWVzLlxyXG4gKiBAZnVuY3Rpb25cclxuICogQHBhcmFtIHtqUXVlcnkgfHwgSFRNTH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3Qgb3IgRE9NIGVsZW1lbnQgZm9yIHdoaWNoIHRvIGdldCB0aGUgZGltZW5zaW9ucy4gQ2FuIGJlIGFueSBlbGVtZW50IG90aGVyIHRoYXQgZG9jdW1lbnQgb3Igd2luZG93LlxyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSAtIG5lc3RlZCBvYmplY3Qgb2YgaW50ZWdlciBwaXhlbCB2YWx1ZXNcclxuICogVE9ETyAtIGlmIGVsZW1lbnQgaXMgd2luZG93LCByZXR1cm4gb25seSB0aG9zZSB2YWx1ZXMuXHJcbiAqL1xyXG5mdW5jdGlvbiBHZXREaW1lbnNpb25zKGVsZW0sIHRlc3Qpe1xyXG4gIGVsZW0gPSBlbGVtLmxlbmd0aCA/IGVsZW1bMF0gOiBlbGVtO1xyXG5cclxuICBpZiAoZWxlbSA9PT0gd2luZG93IHx8IGVsZW0gPT09IGRvY3VtZW50KSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJJJ20gc29ycnksIERhdmUuIEknbSBhZnJhaWQgSSBjYW4ndCBkbyB0aGF0LlwiKTtcclxuICB9XHJcblxyXG4gIHZhciByZWN0ID0gZWxlbS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcclxuICAgICAgcGFyUmVjdCA9IGVsZW0ucGFyZW50Tm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcclxuICAgICAgd2luUmVjdCA9IGRvY3VtZW50LmJvZHkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXHJcbiAgICAgIHdpblkgPSB3aW5kb3cucGFnZVlPZmZzZXQsXHJcbiAgICAgIHdpblggPSB3aW5kb3cucGFnZVhPZmZzZXQ7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICB3aWR0aDogcmVjdC53aWR0aCxcclxuICAgIGhlaWdodDogcmVjdC5oZWlnaHQsXHJcbiAgICBvZmZzZXQ6IHtcclxuICAgICAgdG9wOiByZWN0LnRvcCArIHdpblksXHJcbiAgICAgIGxlZnQ6IHJlY3QubGVmdCArIHdpblhcclxuICAgIH0sXHJcbiAgICBwYXJlbnREaW1zOiB7XHJcbiAgICAgIHdpZHRoOiBwYXJSZWN0LndpZHRoLFxyXG4gICAgICBoZWlnaHQ6IHBhclJlY3QuaGVpZ2h0LFxyXG4gICAgICBvZmZzZXQ6IHtcclxuICAgICAgICB0b3A6IHBhclJlY3QudG9wICsgd2luWSxcclxuICAgICAgICBsZWZ0OiBwYXJSZWN0LmxlZnQgKyB3aW5YXHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICB3aW5kb3dEaW1zOiB7XHJcbiAgICAgIHdpZHRoOiB3aW5SZWN0LndpZHRoLFxyXG4gICAgICBoZWlnaHQ6IHdpblJlY3QuaGVpZ2h0LFxyXG4gICAgICBvZmZzZXQ6IHtcclxuICAgICAgICB0b3A6IHdpblksXHJcbiAgICAgICAgbGVmdDogd2luWFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhbiBvYmplY3Qgb2YgdG9wIGFuZCBsZWZ0IGludGVnZXIgcGl4ZWwgdmFsdWVzIGZvciBkeW5hbWljYWxseSByZW5kZXJlZCBlbGVtZW50cyxcclxuICogc3VjaCBhczogVG9vbHRpcCwgUmV2ZWFsLCBhbmQgRHJvcGRvd25cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCBmb3IgdGhlIGVsZW1lbnQgYmVpbmcgcG9zaXRpb25lZC5cclxuICogQHBhcmFtIHtqUXVlcnl9IGFuY2hvciAtIGpRdWVyeSBvYmplY3QgZm9yIHRoZSBlbGVtZW50J3MgYW5jaG9yIHBvaW50LlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gcG9zaXRpb24gLSBhIHN0cmluZyByZWxhdGluZyB0byB0aGUgZGVzaXJlZCBwb3NpdGlvbiBvZiB0aGUgZWxlbWVudCwgcmVsYXRpdmUgdG8gaXQncyBhbmNob3JcclxuICogQHBhcmFtIHtOdW1iZXJ9IHZPZmZzZXQgLSBpbnRlZ2VyIHBpeGVsIHZhbHVlIG9mIGRlc2lyZWQgdmVydGljYWwgc2VwYXJhdGlvbiBiZXR3ZWVuIGFuY2hvciBhbmQgZWxlbWVudC5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGhPZmZzZXQgLSBpbnRlZ2VyIHBpeGVsIHZhbHVlIG9mIGRlc2lyZWQgaG9yaXpvbnRhbCBzZXBhcmF0aW9uIGJldHdlZW4gYW5jaG9yIGFuZCBlbGVtZW50LlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGlzT3ZlcmZsb3cgLSBpZiBhIGNvbGxpc2lvbiBldmVudCBpcyBkZXRlY3RlZCwgc2V0cyB0byB0cnVlIHRvIGRlZmF1bHQgdGhlIGVsZW1lbnQgdG8gZnVsbCB3aWR0aCAtIGFueSBkZXNpcmVkIG9mZnNldC5cclxuICogVE9ETyBhbHRlci9yZXdyaXRlIHRvIHdvcmsgd2l0aCBgZW1gIHZhbHVlcyBhcyB3ZWxsL2luc3RlYWQgb2YgcGl4ZWxzXHJcbiAqL1xyXG5mdW5jdGlvbiBHZXRPZmZzZXRzKGVsZW1lbnQsIGFuY2hvciwgcG9zaXRpb24sIHZPZmZzZXQsIGhPZmZzZXQsIGlzT3ZlcmZsb3cpIHtcclxuICB2YXIgJGVsZURpbXMgPSBHZXREaW1lbnNpb25zKGVsZW1lbnQpLFxyXG4gICAgICAkYW5jaG9yRGltcyA9IGFuY2hvciA/IEdldERpbWVuc2lvbnMoYW5jaG9yKSA6IG51bGw7XHJcblxyXG4gIHN3aXRjaCAocG9zaXRpb24pIHtcclxuICAgIGNhc2UgJ3RvcCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogKEZvdW5kYXRpb24ucnRsKCkgPyAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCAtICRlbGVEaW1zLndpZHRoICsgJGFuY2hvckRpbXMud2lkdGggOiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCksXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wIC0gKCRlbGVEaW1zLmhlaWdodCArIHZPZmZzZXQpXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdsZWZ0JzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCAtICgkZWxlRGltcy53aWR0aCArIGhPZmZzZXQpLFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcFxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAncmlnaHQnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgJGFuY2hvckRpbXMud2lkdGggKyBoT2Zmc2V0LFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcFxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnY2VudGVyIHRvcCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogKCRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgKCRhbmNob3JEaW1zLndpZHRoIC8gMikpIC0gKCRlbGVEaW1zLndpZHRoIC8gMiksXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wIC0gKCRlbGVEaW1zLmhlaWdodCArIHZPZmZzZXQpXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdjZW50ZXIgYm90dG9tJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiBpc092ZXJmbG93ID8gaE9mZnNldCA6ICgoJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgKyAoJGFuY2hvckRpbXMud2lkdGggLyAyKSkgLSAoJGVsZURpbXMud2lkdGggLyAyKSksXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wICsgJGFuY2hvckRpbXMuaGVpZ2h0ICsgdk9mZnNldFxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnY2VudGVyIGxlZnQnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0IC0gKCRlbGVEaW1zLndpZHRoICsgaE9mZnNldCksXHJcbiAgICAgICAgdG9wOiAoJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICgkYW5jaG9yRGltcy5oZWlnaHQgLyAyKSkgLSAoJGVsZURpbXMuaGVpZ2h0IC8gMilcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2NlbnRlciByaWdodCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgKyAkYW5jaG9yRGltcy53aWR0aCArIGhPZmZzZXQgKyAxLFxyXG4gICAgICAgIHRvcDogKCRhbmNob3JEaW1zLm9mZnNldC50b3AgKyAoJGFuY2hvckRpbXMuaGVpZ2h0IC8gMikpIC0gKCRlbGVEaW1zLmhlaWdodCAvIDIpXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdjZW50ZXInOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICgkZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC5sZWZ0ICsgKCRlbGVEaW1zLndpbmRvd0RpbXMud2lkdGggLyAyKSkgLSAoJGVsZURpbXMud2lkdGggLyAyKSxcclxuICAgICAgICB0b3A6ICgkZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC50b3AgKyAoJGVsZURpbXMud2luZG93RGltcy5oZWlnaHQgLyAyKSkgLSAoJGVsZURpbXMuaGVpZ2h0IC8gMilcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ3JldmVhbCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogKCRlbGVEaW1zLndpbmRvd0RpbXMud2lkdGggLSAkZWxlRGltcy53aWR0aCkgLyAyLFxyXG4gICAgICAgIHRvcDogJGVsZURpbXMud2luZG93RGltcy5vZmZzZXQudG9wICsgdk9mZnNldFxyXG4gICAgICB9XHJcbiAgICBjYXNlICdyZXZlYWwgZnVsbCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogJGVsZURpbXMud2luZG93RGltcy5vZmZzZXQubGVmdCxcclxuICAgICAgICB0b3A6ICRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LnRvcFxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnbGVmdCBib3R0b20nOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0LFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICRhbmNob3JEaW1zLmhlaWdodCArIHZPZmZzZXRcclxuICAgICAgfTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdyaWdodCBib3R0b20nOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgJGFuY2hvckRpbXMud2lkdGggKyBoT2Zmc2V0IC0gJGVsZURpbXMud2lkdGgsXHJcbiAgICAgICAgdG9wOiAkYW5jaG9yRGltcy5vZmZzZXQudG9wICsgJGFuY2hvckRpbXMuaGVpZ2h0ICsgdk9mZnNldFxyXG4gICAgICB9O1xyXG4gICAgICBicmVhaztcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogKEZvdW5kYXRpb24ucnRsKCkgPyAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCAtICRlbGVEaW1zLndpZHRoICsgJGFuY2hvckRpbXMud2lkdGggOiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArIGhPZmZzZXQpLFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICRhbmNob3JEaW1zLmhlaWdodCArIHZPZmZzZXRcclxuICAgICAgfVxyXG4gIH1cclxufVxyXG5cclxufShqUXVlcnkpO1xyXG4iLCIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxyXG4gKiBUaGlzIHV0aWwgd2FzIGNyZWF0ZWQgYnkgTWFyaXVzIE9sYmVydHogKlxyXG4gKiBQbGVhc2UgdGhhbmsgTWFyaXVzIG9uIEdpdEh1YiAvb3dsYmVydHogKlxyXG4gKiBvciB0aGUgd2ViIGh0dHA6Ly93d3cubWFyaXVzb2xiZXJ0ei5kZS8gKlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxyXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbmNvbnN0IGtleUNvZGVzID0ge1xyXG4gIDk6ICdUQUInLFxyXG4gIDEzOiAnRU5URVInLFxyXG4gIDI3OiAnRVNDQVBFJyxcclxuICAzMjogJ1NQQUNFJyxcclxuICAzNzogJ0FSUk9XX0xFRlQnLFxyXG4gIDM4OiAnQVJST1dfVVAnLFxyXG4gIDM5OiAnQVJST1dfUklHSFQnLFxyXG4gIDQwOiAnQVJST1dfRE9XTidcclxufVxyXG5cclxudmFyIGNvbW1hbmRzID0ge31cclxuXHJcbnZhciBLZXlib2FyZCA9IHtcclxuICBrZXlzOiBnZXRLZXlDb2RlcyhrZXlDb2RlcyksXHJcblxyXG4gIC8qKlxyXG4gICAqIFBhcnNlcyB0aGUgKGtleWJvYXJkKSBldmVudCBhbmQgcmV0dXJucyBhIFN0cmluZyB0aGF0IHJlcHJlc2VudHMgaXRzIGtleVxyXG4gICAqIENhbiBiZSB1c2VkIGxpa2UgRm91bmRhdGlvbi5wYXJzZUtleShldmVudCkgPT09IEZvdW5kYXRpb24ua2V5cy5TUEFDRVxyXG4gICAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gdGhlIGV2ZW50IGdlbmVyYXRlZCBieSB0aGUgZXZlbnQgaGFuZGxlclxyXG4gICAqIEByZXR1cm4gU3RyaW5nIGtleSAtIFN0cmluZyB0aGF0IHJlcHJlc2VudHMgdGhlIGtleSBwcmVzc2VkXHJcbiAgICovXHJcbiAgcGFyc2VLZXkoZXZlbnQpIHtcclxuICAgIHZhciBrZXkgPSBrZXlDb2Rlc1tldmVudC53aGljaCB8fCBldmVudC5rZXlDb2RlXSB8fCBTdHJpbmcuZnJvbUNoYXJDb2RlKGV2ZW50LndoaWNoKS50b1VwcGVyQ2FzZSgpO1xyXG5cclxuICAgIC8vIFJlbW92ZSB1bi1wcmludGFibGUgY2hhcmFjdGVycywgZS5nLiBmb3IgYGZyb21DaGFyQ29kZWAgY2FsbHMgZm9yIENUUkwgb25seSBldmVudHNcclxuICAgIGtleSA9IGtleS5yZXBsYWNlKC9cXFcrLywgJycpO1xyXG5cclxuICAgIGlmIChldmVudC5zaGlmdEtleSkga2V5ID0gYFNISUZUXyR7a2V5fWA7XHJcbiAgICBpZiAoZXZlbnQuY3RybEtleSkga2V5ID0gYENUUkxfJHtrZXl9YDtcclxuICAgIGlmIChldmVudC5hbHRLZXkpIGtleSA9IGBBTFRfJHtrZXl9YDtcclxuXHJcbiAgICAvLyBSZW1vdmUgdHJhaWxpbmcgdW5kZXJzY29yZSwgaW4gY2FzZSBvbmx5IG1vZGlmaWVycyB3ZXJlIHVzZWQgKGUuZy4gb25seSBgQ1RSTF9BTFRgKVxyXG4gICAga2V5ID0ga2V5LnJlcGxhY2UoL18kLywgJycpO1xyXG5cclxuICAgIHJldHVybiBrZXk7XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlcyB0aGUgZ2l2ZW4gKGtleWJvYXJkKSBldmVudFxyXG4gICAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gdGhlIGV2ZW50IGdlbmVyYXRlZCBieSB0aGUgZXZlbnQgaGFuZGxlclxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb21wb25lbnQgLSBGb3VuZGF0aW9uIGNvbXBvbmVudCdzIG5hbWUsIGUuZy4gU2xpZGVyIG9yIFJldmVhbFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0c30gZnVuY3Rpb25zIC0gY29sbGVjdGlvbiBvZiBmdW5jdGlvbnMgdGhhdCBhcmUgdG8gYmUgZXhlY3V0ZWRcclxuICAgKi9cclxuICBoYW5kbGVLZXkoZXZlbnQsIGNvbXBvbmVudCwgZnVuY3Rpb25zKSB7XHJcbiAgICB2YXIgY29tbWFuZExpc3QgPSBjb21tYW5kc1tjb21wb25lbnRdLFxyXG4gICAgICBrZXlDb2RlID0gdGhpcy5wYXJzZUtleShldmVudCksXHJcbiAgICAgIGNtZHMsXHJcbiAgICAgIGNvbW1hbmQsXHJcbiAgICAgIGZuO1xyXG5cclxuICAgIGlmICghY29tbWFuZExpc3QpIHJldHVybiBjb25zb2xlLndhcm4oJ0NvbXBvbmVudCBub3QgZGVmaW5lZCEnKTtcclxuXHJcbiAgICBpZiAodHlwZW9mIGNvbW1hbmRMaXN0Lmx0ciA9PT0gJ3VuZGVmaW5lZCcpIHsgLy8gdGhpcyBjb21wb25lbnQgZG9lcyBub3QgZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGx0ciBhbmQgcnRsXHJcbiAgICAgICAgY21kcyA9IGNvbW1hbmRMaXN0OyAvLyB1c2UgcGxhaW4gbGlzdFxyXG4gICAgfSBlbHNlIHsgLy8gbWVyZ2UgbHRyIGFuZCBydGw6IGlmIGRvY3VtZW50IGlzIHJ0bCwgcnRsIG92ZXJ3cml0ZXMgbHRyIGFuZCB2aWNlIHZlcnNhXHJcbiAgICAgICAgaWYgKEZvdW5kYXRpb24ucnRsKCkpIGNtZHMgPSAkLmV4dGVuZCh7fSwgY29tbWFuZExpc3QubHRyLCBjb21tYW5kTGlzdC5ydGwpO1xyXG5cclxuICAgICAgICBlbHNlIGNtZHMgPSAkLmV4dGVuZCh7fSwgY29tbWFuZExpc3QucnRsLCBjb21tYW5kTGlzdC5sdHIpO1xyXG4gICAgfVxyXG4gICAgY29tbWFuZCA9IGNtZHNba2V5Q29kZV07XHJcblxyXG4gICAgZm4gPSBmdW5jdGlvbnNbY29tbWFuZF07XHJcbiAgICBpZiAoZm4gJiYgdHlwZW9mIGZuID09PSAnZnVuY3Rpb24nKSB7IC8vIGV4ZWN1dGUgZnVuY3Rpb24gIGlmIGV4aXN0c1xyXG4gICAgICB2YXIgcmV0dXJuVmFsdWUgPSBmbi5hcHBseSgpO1xyXG4gICAgICBpZiAoZnVuY3Rpb25zLmhhbmRsZWQgfHwgdHlwZW9mIGZ1bmN0aW9ucy5oYW5kbGVkID09PSAnZnVuY3Rpb24nKSB7IC8vIGV4ZWN1dGUgZnVuY3Rpb24gd2hlbiBldmVudCB3YXMgaGFuZGxlZFxyXG4gICAgICAgICAgZnVuY3Rpb25zLmhhbmRsZWQocmV0dXJuVmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZiAoZnVuY3Rpb25zLnVuaGFuZGxlZCB8fCB0eXBlb2YgZnVuY3Rpb25zLnVuaGFuZGxlZCA9PT0gJ2Z1bmN0aW9uJykgeyAvLyBleGVjdXRlIGZ1bmN0aW9uIHdoZW4gZXZlbnQgd2FzIG5vdCBoYW5kbGVkXHJcbiAgICAgICAgICBmdW5jdGlvbnMudW5oYW5kbGVkKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBGaW5kcyBhbGwgZm9jdXNhYmxlIGVsZW1lbnRzIHdpdGhpbiB0aGUgZ2l2ZW4gYCRlbGVtZW50YFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gc2VhcmNoIHdpdGhpblxyXG4gICAqIEByZXR1cm4ge2pRdWVyeX0gJGZvY3VzYWJsZSAtIGFsbCBmb2N1c2FibGUgZWxlbWVudHMgd2l0aGluIGAkZWxlbWVudGBcclxuICAgKi9cclxuICBmaW5kRm9jdXNhYmxlKCRlbGVtZW50KSB7XHJcbiAgICBpZighJGVsZW1lbnQpIHtyZXR1cm4gZmFsc2U7IH1cclxuICAgIHJldHVybiAkZWxlbWVudC5maW5kKCdhW2hyZWZdLCBhcmVhW2hyZWZdLCBpbnB1dDpub3QoW2Rpc2FibGVkXSksIHNlbGVjdDpub3QoW2Rpc2FibGVkXSksIHRleHRhcmVhOm5vdChbZGlzYWJsZWRdKSwgYnV0dG9uOm5vdChbZGlzYWJsZWRdKSwgaWZyYW1lLCBvYmplY3QsIGVtYmVkLCAqW3RhYmluZGV4XSwgKltjb250ZW50ZWRpdGFibGVdJykuZmlsdGVyKGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAoISQodGhpcykuaXMoJzp2aXNpYmxlJykgfHwgJCh0aGlzKS5hdHRyKCd0YWJpbmRleCcpIDwgMCkgeyByZXR1cm4gZmFsc2U7IH0gLy9vbmx5IGhhdmUgdmlzaWJsZSBlbGVtZW50cyBhbmQgdGhvc2UgdGhhdCBoYXZlIGEgdGFiaW5kZXggZ3JlYXRlciBvciBlcXVhbCAwXHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSk7XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgY29tcG9uZW50IG5hbWUgbmFtZVxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjb21wb25lbnQgLSBGb3VuZGF0aW9uIGNvbXBvbmVudCwgZS5nLiBTbGlkZXIgb3IgUmV2ZWFsXHJcbiAgICogQHJldHVybiBTdHJpbmcgY29tcG9uZW50TmFtZVxyXG4gICAqL1xyXG5cclxuICByZWdpc3Rlcihjb21wb25lbnROYW1lLCBjbWRzKSB7XHJcbiAgICBjb21tYW5kc1tjb21wb25lbnROYW1lXSA9IGNtZHM7XHJcbiAgfSwgIFxyXG5cclxuICAvKipcclxuICAgKiBUcmFwcyB0aGUgZm9jdXMgaW4gdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICogQHBhcmFtICB7alF1ZXJ5fSAkZWxlbWVudCAgalF1ZXJ5IG9iamVjdCB0byB0cmFwIHRoZSBmb3VjcyBpbnRvLlxyXG4gICAqL1xyXG4gIHRyYXBGb2N1cygkZWxlbWVudCkge1xyXG4gICAgdmFyICRmb2N1c2FibGUgPSBGb3VuZGF0aW9uLktleWJvYXJkLmZpbmRGb2N1c2FibGUoJGVsZW1lbnQpLFxyXG4gICAgICAgICRmaXJzdEZvY3VzYWJsZSA9ICRmb2N1c2FibGUuZXEoMCksXHJcbiAgICAgICAgJGxhc3RGb2N1c2FibGUgPSAkZm9jdXNhYmxlLmVxKC0xKTtcclxuXHJcbiAgICAkZWxlbWVudC5vbigna2V5ZG93bi56Zi50cmFwZm9jdXMnLCBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICBpZiAoZXZlbnQudGFyZ2V0ID09PSAkbGFzdEZvY3VzYWJsZVswXSAmJiBGb3VuZGF0aW9uLktleWJvYXJkLnBhcnNlS2V5KGV2ZW50KSA9PT0gJ1RBQicpIHtcclxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICRmaXJzdEZvY3VzYWJsZS5mb2N1cygpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2UgaWYgKGV2ZW50LnRhcmdldCA9PT0gJGZpcnN0Rm9jdXNhYmxlWzBdICYmIEZvdW5kYXRpb24uS2V5Ym9hcmQucGFyc2VLZXkoZXZlbnQpID09PSAnU0hJRlRfVEFCJykge1xyXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgJGxhc3RGb2N1c2FibGUuZm9jdXMoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSxcclxuICAvKipcclxuICAgKiBSZWxlYXNlcyB0aGUgdHJhcHBlZCBmb2N1cyBmcm9tIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAqIEBwYXJhbSAge2pRdWVyeX0gJGVsZW1lbnQgIGpRdWVyeSBvYmplY3QgdG8gcmVsZWFzZSB0aGUgZm9jdXMgZm9yLlxyXG4gICAqL1xyXG4gIHJlbGVhc2VGb2N1cygkZWxlbWVudCkge1xyXG4gICAgJGVsZW1lbnQub2ZmKCdrZXlkb3duLnpmLnRyYXBmb2N1cycpO1xyXG4gIH1cclxufVxyXG5cclxuLypcclxuICogQ29uc3RhbnRzIGZvciBlYXNpZXIgY29tcGFyaW5nLlxyXG4gKiBDYW4gYmUgdXNlZCBsaWtlIEZvdW5kYXRpb24ucGFyc2VLZXkoZXZlbnQpID09PSBGb3VuZGF0aW9uLmtleXMuU1BBQ0VcclxuICovXHJcbmZ1bmN0aW9uIGdldEtleUNvZGVzKGtjcykge1xyXG4gIHZhciBrID0ge307XHJcbiAgZm9yICh2YXIga2MgaW4ga2NzKSBrW2tjc1trY11dID0ga2NzW2tjXTtcclxuICByZXR1cm4gaztcclxufVxyXG5cclxuRm91bmRhdGlvbi5LZXlib2FyZCA9IEtleWJvYXJkO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLy8gRGVmYXVsdCBzZXQgb2YgbWVkaWEgcXVlcmllc1xyXG5jb25zdCBkZWZhdWx0UXVlcmllcyA9IHtcclxuICAnZGVmYXVsdCcgOiAnb25seSBzY3JlZW4nLFxyXG4gIGxhbmRzY2FwZSA6ICdvbmx5IHNjcmVlbiBhbmQgKG9yaWVudGF0aW9uOiBsYW5kc2NhcGUpJyxcclxuICBwb3J0cmFpdCA6ICdvbmx5IHNjcmVlbiBhbmQgKG9yaWVudGF0aW9uOiBwb3J0cmFpdCknLFxyXG4gIHJldGluYSA6ICdvbmx5IHNjcmVlbiBhbmQgKC13ZWJraXQtbWluLWRldmljZS1waXhlbC1yYXRpbzogMiksJyArXHJcbiAgICAnb25seSBzY3JlZW4gYW5kIChtaW4tLW1vei1kZXZpY2UtcGl4ZWwtcmF0aW86IDIpLCcgK1xyXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAoLW8tbWluLWRldmljZS1waXhlbC1yYXRpbzogMi8xKSwnICtcclxuICAgICdvbmx5IHNjcmVlbiBhbmQgKG1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDIpLCcgK1xyXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDE5MmRwaSksJyArXHJcbiAgICAnb25seSBzY3JlZW4gYW5kIChtaW4tcmVzb2x1dGlvbjogMmRwcHgpJ1xyXG59O1xyXG5cclxudmFyIE1lZGlhUXVlcnkgPSB7XHJcbiAgcXVlcmllczogW10sXHJcblxyXG4gIGN1cnJlbnQ6ICcnLFxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgbWVkaWEgcXVlcnkgaGVscGVyLCBieSBleHRyYWN0aW5nIHRoZSBicmVha3BvaW50IGxpc3QgZnJvbSB0aGUgQ1NTIGFuZCBhY3RpdmF0aW5nIHRoZSBicmVha3BvaW50IHdhdGNoZXIuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHZhciBleHRyYWN0ZWRTdHlsZXMgPSAkKCcuZm91bmRhdGlvbi1tcScpLmNzcygnZm9udC1mYW1pbHknKTtcclxuICAgIHZhciBuYW1lZFF1ZXJpZXM7XHJcblxyXG4gICAgbmFtZWRRdWVyaWVzID0gcGFyc2VTdHlsZVRvT2JqZWN0KGV4dHJhY3RlZFN0eWxlcyk7XHJcblxyXG4gICAgZm9yICh2YXIga2V5IGluIG5hbWVkUXVlcmllcykge1xyXG4gICAgICBpZihuYW1lZFF1ZXJpZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG4gICAgICAgIHNlbGYucXVlcmllcy5wdXNoKHtcclxuICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgIHZhbHVlOiBgb25seSBzY3JlZW4gYW5kIChtaW4td2lkdGg6ICR7bmFtZWRRdWVyaWVzW2tleV19KWBcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY3VycmVudCA9IHRoaXMuX2dldEN1cnJlbnRTaXplKCk7XHJcblxyXG4gICAgdGhpcy5fd2F0Y2hlcigpO1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyBpZiB0aGUgc2NyZWVuIGlzIGF0IGxlYXN0IGFzIHdpZGUgYXMgYSBicmVha3BvaW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzaXplIC0gTmFtZSBvZiB0aGUgYnJlYWtwb2ludCB0byBjaGVjay5cclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gYHRydWVgIGlmIHRoZSBicmVha3BvaW50IG1hdGNoZXMsIGBmYWxzZWAgaWYgaXQncyBzbWFsbGVyLlxyXG4gICAqL1xyXG4gIGF0TGVhc3Qoc2l6ZSkge1xyXG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5nZXQoc2l6ZSk7XHJcblxyXG4gICAgaWYgKHF1ZXJ5KSB7XHJcbiAgICAgIHJldHVybiB3aW5kb3cubWF0Y2hNZWRpYShxdWVyeSkubWF0Y2hlcztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIGlmIHRoZSBzY3JlZW4gbWF0Y2hlcyB0byBhIGJyZWFrcG9pbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNpemUgLSBOYW1lIG9mIHRoZSBicmVha3BvaW50IHRvIGNoZWNrLCBlaXRoZXIgJ3NtYWxsIG9ubHknIG9yICdzbWFsbCcuIE9taXR0aW5nICdvbmx5JyBmYWxscyBiYWNrIHRvIHVzaW5nIGF0TGVhc3QoKSBtZXRob2QuXHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgYnJlYWtwb2ludCBtYXRjaGVzLCBgZmFsc2VgIGlmIGl0IGRvZXMgbm90LlxyXG4gICAqL1xyXG4gIGlzKHNpemUpIHtcclxuICAgIHNpemUgPSBzaXplLnRyaW0oKS5zcGxpdCgnICcpO1xyXG4gICAgaWYoc2l6ZS5sZW5ndGggPiAxICYmIHNpemVbMV0gPT09ICdvbmx5Jykge1xyXG4gICAgICBpZihzaXplWzBdID09PSB0aGlzLl9nZXRDdXJyZW50U2l6ZSgpKSByZXR1cm4gdHJ1ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmF0TGVhc3Qoc2l6ZVswXSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogR2V0cyB0aGUgbWVkaWEgcXVlcnkgb2YgYSBicmVha3BvaW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzaXplIC0gTmFtZSBvZiB0aGUgYnJlYWtwb2ludCB0byBnZXQuXHJcbiAgICogQHJldHVybnMge1N0cmluZ3xudWxsfSAtIFRoZSBtZWRpYSBxdWVyeSBvZiB0aGUgYnJlYWtwb2ludCwgb3IgYG51bGxgIGlmIHRoZSBicmVha3BvaW50IGRvZXNuJ3QgZXhpc3QuXHJcbiAgICovXHJcbiAgZ2V0KHNpemUpIHtcclxuICAgIGZvciAodmFyIGkgaW4gdGhpcy5xdWVyaWVzKSB7XHJcbiAgICAgIGlmKHRoaXMucXVlcmllcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xyXG4gICAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1tpXTtcclxuICAgICAgICBpZiAoc2l6ZSA9PT0gcXVlcnkubmFtZSkgcmV0dXJuIHF1ZXJ5LnZhbHVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogR2V0cyB0aGUgY3VycmVudCBicmVha3BvaW50IG5hbWUgYnkgdGVzdGluZyBldmVyeSBicmVha3BvaW50IGFuZCByZXR1cm5pbmcgdGhlIGxhc3Qgb25lIHRvIG1hdGNoICh0aGUgYmlnZ2VzdCBvbmUpLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHJldHVybnMge1N0cmluZ30gTmFtZSBvZiB0aGUgY3VycmVudCBicmVha3BvaW50LlxyXG4gICAqL1xyXG4gIF9nZXRDdXJyZW50U2l6ZSgpIHtcclxuICAgIHZhciBtYXRjaGVkO1xyXG5cclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1tpXTtcclxuXHJcbiAgICAgIGlmICh3aW5kb3cubWF0Y2hNZWRpYShxdWVyeS52YWx1ZSkubWF0Y2hlcykge1xyXG4gICAgICAgIG1hdGNoZWQgPSBxdWVyeTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgbWF0Y2hlZCA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgcmV0dXJuIG1hdGNoZWQubmFtZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBtYXRjaGVkO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEFjdGl2YXRlcyB0aGUgYnJlYWtwb2ludCB3YXRjaGVyLCB3aGljaCBmaXJlcyBhbiBldmVudCBvbiB0aGUgd2luZG93IHdoZW5ldmVyIHRoZSBicmVha3BvaW50IGNoYW5nZXMuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfd2F0Y2hlcigpIHtcclxuICAgICQod2luZG93KS5vbigncmVzaXplLnpmLm1lZGlhcXVlcnknLCAoKSA9PiB7XHJcbiAgICAgIHZhciBuZXdTaXplID0gdGhpcy5fZ2V0Q3VycmVudFNpemUoKSwgY3VycmVudFNpemUgPSB0aGlzLmN1cnJlbnQ7XHJcblxyXG4gICAgICBpZiAobmV3U2l6ZSAhPT0gY3VycmVudFNpemUpIHtcclxuICAgICAgICAvLyBDaGFuZ2UgdGhlIGN1cnJlbnQgbWVkaWEgcXVlcnlcclxuICAgICAgICB0aGlzLmN1cnJlbnQgPSBuZXdTaXplO1xyXG5cclxuICAgICAgICAvLyBCcm9hZGNhc3QgdGhlIG1lZGlhIHF1ZXJ5IGNoYW5nZSBvbiB0aGUgd2luZG93XHJcbiAgICAgICAgJCh3aW5kb3cpLnRyaWdnZXIoJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIFtuZXdTaXplLCBjdXJyZW50U2l6ZV0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbn07XHJcblxyXG5Gb3VuZGF0aW9uLk1lZGlhUXVlcnkgPSBNZWRpYVF1ZXJ5O1xyXG5cclxuLy8gbWF0Y2hNZWRpYSgpIHBvbHlmaWxsIC0gVGVzdCBhIENTUyBtZWRpYSB0eXBlL3F1ZXJ5IGluIEpTLlxyXG4vLyBBdXRob3JzICYgY29weXJpZ2h0IChjKSAyMDEyOiBTY290dCBKZWhsLCBQYXVsIElyaXNoLCBOaWNob2xhcyBaYWthcywgRGF2aWQgS25pZ2h0LiBEdWFsIE1JVC9CU0QgbGljZW5zZVxyXG53aW5kb3cubWF0Y2hNZWRpYSB8fCAod2luZG93Lm1hdGNoTWVkaWEgPSBmdW5jdGlvbigpIHtcclxuICAndXNlIHN0cmljdCc7XHJcblxyXG4gIC8vIEZvciBicm93c2VycyB0aGF0IHN1cHBvcnQgbWF0Y2hNZWRpdW0gYXBpIHN1Y2ggYXMgSUUgOSBhbmQgd2Via2l0XHJcbiAgdmFyIHN0eWxlTWVkaWEgPSAod2luZG93LnN0eWxlTWVkaWEgfHwgd2luZG93Lm1lZGlhKTtcclxuXHJcbiAgLy8gRm9yIHRob3NlIHRoYXQgZG9uJ3Qgc3VwcG9ydCBtYXRjaE1lZGl1bVxyXG4gIGlmICghc3R5bGVNZWRpYSkge1xyXG4gICAgdmFyIHN0eWxlICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpLFxyXG4gICAgc2NyaXB0ICAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0JylbMF0sXHJcbiAgICBpbmZvICAgICAgICA9IG51bGw7XHJcblxyXG4gICAgc3R5bGUudHlwZSAgPSAndGV4dC9jc3MnO1xyXG4gICAgc3R5bGUuaWQgICAgPSAnbWF0Y2htZWRpYWpzLXRlc3QnO1xyXG5cclxuICAgIHNjcmlwdCAmJiBzY3JpcHQucGFyZW50Tm9kZSAmJiBzY3JpcHQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoc3R5bGUsIHNjcmlwdCk7XHJcblxyXG4gICAgLy8gJ3N0eWxlLmN1cnJlbnRTdHlsZScgaXMgdXNlZCBieSBJRSA8PSA4IGFuZCAnd2luZG93LmdldENvbXB1dGVkU3R5bGUnIGZvciBhbGwgb3RoZXIgYnJvd3NlcnNcclxuICAgIGluZm8gPSAoJ2dldENvbXB1dGVkU3R5bGUnIGluIHdpbmRvdykgJiYgd2luZG93LmdldENvbXB1dGVkU3R5bGUoc3R5bGUsIG51bGwpIHx8IHN0eWxlLmN1cnJlbnRTdHlsZTtcclxuXHJcbiAgICBzdHlsZU1lZGlhID0ge1xyXG4gICAgICBtYXRjaE1lZGl1bShtZWRpYSkge1xyXG4gICAgICAgIHZhciB0ZXh0ID0gYEBtZWRpYSAke21lZGlhfXsgI21hdGNobWVkaWFqcy10ZXN0IHsgd2lkdGg6IDFweDsgfSB9YDtcclxuXHJcbiAgICAgICAgLy8gJ3N0eWxlLnN0eWxlU2hlZXQnIGlzIHVzZWQgYnkgSUUgPD0gOCBhbmQgJ3N0eWxlLnRleHRDb250ZW50JyBmb3IgYWxsIG90aGVyIGJyb3dzZXJzXHJcbiAgICAgICAgaWYgKHN0eWxlLnN0eWxlU2hlZXQpIHtcclxuICAgICAgICAgIHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IHRleHQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gdGV4dDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFRlc3QgaWYgbWVkaWEgcXVlcnkgaXMgdHJ1ZSBvciBmYWxzZVxyXG4gICAgICAgIHJldHVybiBpbmZvLndpZHRoID09PSAnMXB4JztcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGZ1bmN0aW9uKG1lZGlhKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBtYXRjaGVzOiBzdHlsZU1lZGlhLm1hdGNoTWVkaXVtKG1lZGlhIHx8ICdhbGwnKSxcclxuICAgICAgbWVkaWE6IG1lZGlhIHx8ICdhbGwnXHJcbiAgICB9O1xyXG4gIH1cclxufSgpKTtcclxuXHJcbi8vIFRoYW5rIHlvdTogaHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9xdWVyeS1zdHJpbmdcclxuZnVuY3Rpb24gcGFyc2VTdHlsZVRvT2JqZWN0KHN0cikge1xyXG4gIHZhciBzdHlsZU9iamVjdCA9IHt9O1xyXG5cclxuICBpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcclxuICAgIHJldHVybiBzdHlsZU9iamVjdDtcclxuICB9XHJcblxyXG4gIHN0ciA9IHN0ci50cmltKCkuc2xpY2UoMSwgLTEpOyAvLyBicm93c2VycyByZS1xdW90ZSBzdHJpbmcgc3R5bGUgdmFsdWVzXHJcblxyXG4gIGlmICghc3RyKSB7XHJcbiAgICByZXR1cm4gc3R5bGVPYmplY3Q7XHJcbiAgfVxyXG5cclxuICBzdHlsZU9iamVjdCA9IHN0ci5zcGxpdCgnJicpLnJlZHVjZShmdW5jdGlvbihyZXQsIHBhcmFtKSB7XHJcbiAgICB2YXIgcGFydHMgPSBwYXJhbS5yZXBsYWNlKC9cXCsvZywgJyAnKS5zcGxpdCgnPScpO1xyXG4gICAgdmFyIGtleSA9IHBhcnRzWzBdO1xyXG4gICAgdmFyIHZhbCA9IHBhcnRzWzFdO1xyXG4gICAga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGtleSk7XHJcblxyXG4gICAgLy8gbWlzc2luZyBgPWAgc2hvdWxkIGJlIGBudWxsYDpcclxuICAgIC8vIGh0dHA6Ly93My5vcmcvVFIvMjAxMi9XRC11cmwtMjAxMjA1MjQvI2NvbGxlY3QtdXJsLXBhcmFtZXRlcnNcclxuICAgIHZhbCA9IHZhbCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGRlY29kZVVSSUNvbXBvbmVudCh2YWwpO1xyXG5cclxuICAgIGlmICghcmV0Lmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgcmV0W2tleV0gPSB2YWw7XHJcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocmV0W2tleV0pKSB7XHJcbiAgICAgIHJldFtrZXldLnB1c2godmFsKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldFtrZXldID0gW3JldFtrZXldLCB2YWxdO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJldDtcclxuICB9LCB7fSk7XHJcblxyXG4gIHJldHVybiBzdHlsZU9iamVjdDtcclxufVxyXG5cclxuRm91bmRhdGlvbi5NZWRpYVF1ZXJ5ID0gTWVkaWFRdWVyeTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBNb3Rpb24gbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24ubW90aW9uXHJcbiAqL1xyXG5cclxuY29uc3QgaW5pdENsYXNzZXMgICA9IFsnbXVpLWVudGVyJywgJ211aS1sZWF2ZSddO1xyXG5jb25zdCBhY3RpdmVDbGFzc2VzID0gWydtdWktZW50ZXItYWN0aXZlJywgJ211aS1sZWF2ZS1hY3RpdmUnXTtcclxuXHJcbmNvbnN0IE1vdGlvbiA9IHtcclxuICBhbmltYXRlSW46IGZ1bmN0aW9uKGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpIHtcclxuICAgIGFuaW1hdGUodHJ1ZSwgZWxlbWVudCwgYW5pbWF0aW9uLCBjYik7XHJcbiAgfSxcclxuXHJcbiAgYW5pbWF0ZU91dDogZnVuY3Rpb24oZWxlbWVudCwgYW5pbWF0aW9uLCBjYikge1xyXG4gICAgYW5pbWF0ZShmYWxzZSwgZWxlbWVudCwgYW5pbWF0aW9uLCBjYik7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBNb3ZlKGR1cmF0aW9uLCBlbGVtLCBmbil7XHJcbiAgdmFyIGFuaW0sIHByb2csIHN0YXJ0ID0gbnVsbDtcclxuICAvLyBjb25zb2xlLmxvZygnY2FsbGVkJyk7XHJcblxyXG4gIGlmIChkdXJhdGlvbiA9PT0gMCkge1xyXG4gICAgZm4uYXBwbHkoZWxlbSk7XHJcbiAgICBlbGVtLnRyaWdnZXIoJ2ZpbmlzaGVkLnpmLmFuaW1hdGUnLCBbZWxlbV0pLnRyaWdnZXJIYW5kbGVyKCdmaW5pc2hlZC56Zi5hbmltYXRlJywgW2VsZW1dKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIG1vdmUodHMpe1xyXG4gICAgaWYoIXN0YXJ0KSBzdGFydCA9IHRzO1xyXG4gICAgLy8gY29uc29sZS5sb2coc3RhcnQsIHRzKTtcclxuICAgIHByb2cgPSB0cyAtIHN0YXJ0O1xyXG4gICAgZm4uYXBwbHkoZWxlbSk7XHJcblxyXG4gICAgaWYocHJvZyA8IGR1cmF0aW9uKXsgYW5pbSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobW92ZSwgZWxlbSk7IH1cclxuICAgIGVsc2V7XHJcbiAgICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZShhbmltKTtcclxuICAgICAgZWxlbS50cmlnZ2VyKCdmaW5pc2hlZC56Zi5hbmltYXRlJywgW2VsZW1dKS50cmlnZ2VySGFuZGxlcignZmluaXNoZWQuemYuYW5pbWF0ZScsIFtlbGVtXSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGFuaW0gPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKG1vdmUpO1xyXG59XHJcblxyXG4vKipcclxuICogQW5pbWF0ZXMgYW4gZWxlbWVudCBpbiBvciBvdXQgdXNpbmcgYSBDU1MgdHJhbnNpdGlvbiBjbGFzcy5cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNJbiAtIERlZmluZXMgaWYgdGhlIGFuaW1hdGlvbiBpcyBpbiBvciBvdXQuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9yIEhUTUwgb2JqZWN0IHRvIGFuaW1hdGUuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBhbmltYXRpb24gLSBDU1MgY2xhc3MgdG8gdXNlLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIENhbGxiYWNrIHRvIHJ1biB3aGVuIGFuaW1hdGlvbiBpcyBmaW5pc2hlZC5cclxuICovXHJcbmZ1bmN0aW9uIGFuaW1hdGUoaXNJbiwgZWxlbWVudCwgYW5pbWF0aW9uLCBjYikge1xyXG4gIGVsZW1lbnQgPSAkKGVsZW1lbnQpLmVxKDApO1xyXG5cclxuICBpZiAoIWVsZW1lbnQubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gIHZhciBpbml0Q2xhc3MgPSBpc0luID8gaW5pdENsYXNzZXNbMF0gOiBpbml0Q2xhc3Nlc1sxXTtcclxuICB2YXIgYWN0aXZlQ2xhc3MgPSBpc0luID8gYWN0aXZlQ2xhc3Nlc1swXSA6IGFjdGl2ZUNsYXNzZXNbMV07XHJcblxyXG4gIC8vIFNldCB1cCB0aGUgYW5pbWF0aW9uXHJcbiAgcmVzZXQoKTtcclxuXHJcbiAgZWxlbWVudFxyXG4gICAgLmFkZENsYXNzKGFuaW1hdGlvbilcclxuICAgIC5jc3MoJ3RyYW5zaXRpb24nLCAnbm9uZScpO1xyXG5cclxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xyXG4gICAgZWxlbWVudC5hZGRDbGFzcyhpbml0Q2xhc3MpO1xyXG4gICAgaWYgKGlzSW4pIGVsZW1lbnQuc2hvdygpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBTdGFydCB0aGUgYW5pbWF0aW9uXHJcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcclxuICAgIGVsZW1lbnRbMF0ub2Zmc2V0V2lkdGg7XHJcbiAgICBlbGVtZW50XHJcbiAgICAgIC5jc3MoJ3RyYW5zaXRpb24nLCAnJylcclxuICAgICAgLmFkZENsYXNzKGFjdGl2ZUNsYXNzKTtcclxuICB9KTtcclxuXHJcbiAgLy8gQ2xlYW4gdXAgdGhlIGFuaW1hdGlvbiB3aGVuIGl0IGZpbmlzaGVzXHJcbiAgZWxlbWVudC5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKGVsZW1lbnQpLCBmaW5pc2gpO1xyXG5cclxuICAvLyBIaWRlcyB0aGUgZWxlbWVudCAoZm9yIG91dCBhbmltYXRpb25zKSwgcmVzZXRzIHRoZSBlbGVtZW50LCBhbmQgcnVucyBhIGNhbGxiYWNrXHJcbiAgZnVuY3Rpb24gZmluaXNoKCkge1xyXG4gICAgaWYgKCFpc0luKSBlbGVtZW50LmhpZGUoKTtcclxuICAgIHJlc2V0KCk7XHJcbiAgICBpZiAoY2IpIGNiLmFwcGx5KGVsZW1lbnQpO1xyXG4gIH1cclxuXHJcbiAgLy8gUmVzZXRzIHRyYW5zaXRpb25zIGFuZCByZW1vdmVzIG1vdGlvbi1zcGVjaWZpYyBjbGFzc2VzXHJcbiAgZnVuY3Rpb24gcmVzZXQoKSB7XHJcbiAgICBlbGVtZW50WzBdLnN0eWxlLnRyYW5zaXRpb25EdXJhdGlvbiA9IDA7XHJcbiAgICBlbGVtZW50LnJlbW92ZUNsYXNzKGAke2luaXRDbGFzc30gJHthY3RpdmVDbGFzc30gJHthbmltYXRpb259YCk7XHJcbiAgfVxyXG59XHJcblxyXG5Gb3VuZGF0aW9uLk1vdmUgPSBNb3ZlO1xyXG5Gb3VuZGF0aW9uLk1vdGlvbiA9IE1vdGlvbjtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbmNvbnN0IE5lc3QgPSB7XHJcbiAgRmVhdGhlcihtZW51LCB0eXBlID0gJ3pmJykge1xyXG4gICAgbWVudS5hdHRyKCdyb2xlJywgJ21lbnViYXInKTtcclxuXHJcbiAgICB2YXIgaXRlbXMgPSBtZW51LmZpbmQoJ2xpJykuYXR0cih7J3JvbGUnOiAnbWVudWl0ZW0nfSksXHJcbiAgICAgICAgc3ViTWVudUNsYXNzID0gYGlzLSR7dHlwZX0tc3VibWVudWAsXHJcbiAgICAgICAgc3ViSXRlbUNsYXNzID0gYCR7c3ViTWVudUNsYXNzfS1pdGVtYCxcclxuICAgICAgICBoYXNTdWJDbGFzcyA9IGBpcy0ke3R5cGV9LXN1Ym1lbnUtcGFyZW50YDtcclxuXHJcbiAgICBpdGVtcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICB2YXIgJGl0ZW0gPSAkKHRoaXMpLFxyXG4gICAgICAgICAgJHN1YiA9ICRpdGVtLmNoaWxkcmVuKCd1bCcpO1xyXG5cclxuICAgICAgaWYgKCRzdWIubGVuZ3RoKSB7XHJcbiAgICAgICAgJGl0ZW1cclxuICAgICAgICAgIC5hZGRDbGFzcyhoYXNTdWJDbGFzcylcclxuICAgICAgICAgIC5hdHRyKHtcclxuICAgICAgICAgICAgJ2FyaWEtaGFzcG9wdXAnOiB0cnVlLFxyXG4gICAgICAgICAgICAnYXJpYS1sYWJlbCc6ICRpdGVtLmNoaWxkcmVuKCdhOmZpcnN0JykudGV4dCgpXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIC8vIE5vdGU6ICBEcmlsbGRvd25zIGJlaGF2ZSBkaWZmZXJlbnRseSBpbiBob3cgdGhleSBoaWRlLCBhbmQgc28gbmVlZFxyXG4gICAgICAgICAgLy8gYWRkaXRpb25hbCBhdHRyaWJ1dGVzLiAgV2Ugc2hvdWxkIGxvb2sgaWYgdGhpcyBwb3NzaWJseSBvdmVyLWdlbmVyYWxpemVkXHJcbiAgICAgICAgICAvLyB1dGlsaXR5IChOZXN0KSBpcyBhcHByb3ByaWF0ZSB3aGVuIHdlIHJld29yayBtZW51cyBpbiA2LjRcclxuICAgICAgICAgIGlmKHR5cGUgPT09ICdkcmlsbGRvd24nKSB7XHJcbiAgICAgICAgICAgICRpdGVtLmF0dHIoeydhcmlhLWV4cGFuZGVkJzogZmFsc2V9KTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgJHN1YlxyXG4gICAgICAgICAgLmFkZENsYXNzKGBzdWJtZW51ICR7c3ViTWVudUNsYXNzfWApXHJcbiAgICAgICAgICAuYXR0cih7XHJcbiAgICAgICAgICAgICdkYXRhLXN1Ym1lbnUnOiAnJyxcclxuICAgICAgICAgICAgJ3JvbGUnOiAnbWVudSdcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIGlmKHR5cGUgPT09ICdkcmlsbGRvd24nKSB7XHJcbiAgICAgICAgICAkc3ViLmF0dHIoeydhcmlhLWhpZGRlbic6IHRydWV9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICgkaXRlbS5wYXJlbnQoJ1tkYXRhLXN1Ym1lbnVdJykubGVuZ3RoKSB7XHJcbiAgICAgICAgJGl0ZW0uYWRkQ2xhc3MoYGlzLXN1Ym1lbnUtaXRlbSAke3N1Ykl0ZW1DbGFzc31gKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuO1xyXG4gIH0sXHJcblxyXG4gIEJ1cm4obWVudSwgdHlwZSkge1xyXG4gICAgdmFyIC8vaXRlbXMgPSBtZW51LmZpbmQoJ2xpJyksXHJcbiAgICAgICAgc3ViTWVudUNsYXNzID0gYGlzLSR7dHlwZX0tc3VibWVudWAsXHJcbiAgICAgICAgc3ViSXRlbUNsYXNzID0gYCR7c3ViTWVudUNsYXNzfS1pdGVtYCxcclxuICAgICAgICBoYXNTdWJDbGFzcyA9IGBpcy0ke3R5cGV9LXN1Ym1lbnUtcGFyZW50YDtcclxuXHJcbiAgICBtZW51XHJcbiAgICAgIC5maW5kKCc+bGksIC5tZW51LCAubWVudSA+IGxpJylcclxuICAgICAgLnJlbW92ZUNsYXNzKGAke3N1Yk1lbnVDbGFzc30gJHtzdWJJdGVtQ2xhc3N9ICR7aGFzU3ViQ2xhc3N9IGlzLXN1Ym1lbnUtaXRlbSBzdWJtZW51IGlzLWFjdGl2ZWApXHJcbiAgICAgIC5yZW1vdmVBdHRyKCdkYXRhLXN1Ym1lbnUnKS5jc3MoJ2Rpc3BsYXknLCAnJyk7XHJcblxyXG4gICAgLy8gY29uc29sZS5sb2coICAgICAgbWVudS5maW5kKCcuJyArIHN1Yk1lbnVDbGFzcyArICcsIC4nICsgc3ViSXRlbUNsYXNzICsgJywgLmhhcy1zdWJtZW51LCAuaXMtc3VibWVudS1pdGVtLCAuc3VibWVudSwgW2RhdGEtc3VibWVudV0nKVxyXG4gICAgLy8gICAgICAgICAgIC5yZW1vdmVDbGFzcyhzdWJNZW51Q2xhc3MgKyAnICcgKyBzdWJJdGVtQ2xhc3MgKyAnIGhhcy1zdWJtZW51IGlzLXN1Ym1lbnUtaXRlbSBzdWJtZW51JylcclxuICAgIC8vICAgICAgICAgICAucmVtb3ZlQXR0cignZGF0YS1zdWJtZW51JykpO1xyXG4gICAgLy8gaXRlbXMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgLy8gICB2YXIgJGl0ZW0gPSAkKHRoaXMpLFxyXG4gICAgLy8gICAgICAgJHN1YiA9ICRpdGVtLmNoaWxkcmVuKCd1bCcpO1xyXG4gICAgLy8gICBpZigkaXRlbS5wYXJlbnQoJ1tkYXRhLXN1Ym1lbnVdJykubGVuZ3RoKXtcclxuICAgIC8vICAgICAkaXRlbS5yZW1vdmVDbGFzcygnaXMtc3VibWVudS1pdGVtICcgKyBzdWJJdGVtQ2xhc3MpO1xyXG4gICAgLy8gICB9XHJcbiAgICAvLyAgIGlmKCRzdWIubGVuZ3RoKXtcclxuICAgIC8vICAgICAkaXRlbS5yZW1vdmVDbGFzcygnaGFzLXN1Ym1lbnUnKTtcclxuICAgIC8vICAgICAkc3ViLnJlbW92ZUNsYXNzKCdzdWJtZW51ICcgKyBzdWJNZW51Q2xhc3MpLnJlbW92ZUF0dHIoJ2RhdGEtc3VibWVudScpO1xyXG4gICAgLy8gICB9XHJcbiAgICAvLyB9KTtcclxuICB9XHJcbn1cclxuXHJcbkZvdW5kYXRpb24uTmVzdCA9IE5lc3Q7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG5mdW5jdGlvbiBUaW1lcihlbGVtLCBvcHRpb25zLCBjYikge1xyXG4gIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgIGR1cmF0aW9uID0gb3B0aW9ucy5kdXJhdGlvbiwvL29wdGlvbnMgaXMgYW4gb2JqZWN0IGZvciBlYXNpbHkgYWRkaW5nIGZlYXR1cmVzIGxhdGVyLlxyXG4gICAgICBuYW1lU3BhY2UgPSBPYmplY3Qua2V5cyhlbGVtLmRhdGEoKSlbMF0gfHwgJ3RpbWVyJyxcclxuICAgICAgcmVtYWluID0gLTEsXHJcbiAgICAgIHN0YXJ0LFxyXG4gICAgICB0aW1lcjtcclxuXHJcbiAgdGhpcy5pc1BhdXNlZCA9IGZhbHNlO1xyXG5cclxuICB0aGlzLnJlc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuICAgIHJlbWFpbiA9IC0xO1xyXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuICAgIHRoaXMuc3RhcnQoKTtcclxuICB9XHJcblxyXG4gIHRoaXMuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuaXNQYXVzZWQgPSBmYWxzZTtcclxuICAgIC8vIGlmKCFlbGVtLmRhdGEoJ3BhdXNlZCcpKXsgcmV0dXJuIGZhbHNlOyB9Ly9tYXliZSBpbXBsZW1lbnQgdGhpcyBzYW5pdHkgY2hlY2sgaWYgdXNlZCBmb3Igb3RoZXIgdGhpbmdzLlxyXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuICAgIHJlbWFpbiA9IHJlbWFpbiA8PSAwID8gZHVyYXRpb24gOiByZW1haW47XHJcbiAgICBlbGVtLmRhdGEoJ3BhdXNlZCcsIGZhbHNlKTtcclxuICAgIHN0YXJ0ID0gRGF0ZS5ub3coKTtcclxuICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICBpZihvcHRpb25zLmluZmluaXRlKXtcclxuICAgICAgICBfdGhpcy5yZXN0YXJ0KCk7Ly9yZXJ1biB0aGUgdGltZXIuXHJcbiAgICAgIH1cclxuICAgICAgaWYgKGNiICYmIHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgeyBjYigpOyB9XHJcbiAgICB9LCByZW1haW4pO1xyXG4gICAgZWxlbS50cmlnZ2VyKGB0aW1lcnN0YXJ0LnpmLiR7bmFtZVNwYWNlfWApO1xyXG4gIH1cclxuXHJcbiAgdGhpcy5wYXVzZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5pc1BhdXNlZCA9IHRydWU7XHJcbiAgICAvL2lmKGVsZW0uZGF0YSgncGF1c2VkJykpeyByZXR1cm4gZmFsc2U7IH0vL21heWJlIGltcGxlbWVudCB0aGlzIHNhbml0eSBjaGVjayBpZiB1c2VkIGZvciBvdGhlciB0aGluZ3MuXHJcbiAgICBjbGVhclRpbWVvdXQodGltZXIpO1xyXG4gICAgZWxlbS5kYXRhKCdwYXVzZWQnLCB0cnVlKTtcclxuICAgIHZhciBlbmQgPSBEYXRlLm5vdygpO1xyXG4gICAgcmVtYWluID0gcmVtYWluIC0gKGVuZCAtIHN0YXJ0KTtcclxuICAgIGVsZW0udHJpZ2dlcihgdGltZXJwYXVzZWQuemYuJHtuYW1lU3BhY2V9YCk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogUnVucyBhIGNhbGxiYWNrIGZ1bmN0aW9uIHdoZW4gaW1hZ2VzIGFyZSBmdWxseSBsb2FkZWQuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbWFnZXMgLSBJbWFnZShzKSB0byBjaGVjayBpZiBsb2FkZWQuXHJcbiAqIEBwYXJhbSB7RnVuY30gY2FsbGJhY2sgLSBGdW5jdGlvbiB0byBleGVjdXRlIHdoZW4gaW1hZ2UgaXMgZnVsbHkgbG9hZGVkLlxyXG4gKi9cclxuZnVuY3Rpb24gb25JbWFnZXNMb2FkZWQoaW1hZ2VzLCBjYWxsYmFjayl7XHJcbiAgdmFyIHNlbGYgPSB0aGlzLFxyXG4gICAgICB1bmxvYWRlZCA9IGltYWdlcy5sZW5ndGg7XHJcblxyXG4gIGlmICh1bmxvYWRlZCA9PT0gMCkge1xyXG4gICAgY2FsbGJhY2soKTtcclxuICB9XHJcblxyXG4gIGltYWdlcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gQ2hlY2sgaWYgaW1hZ2UgaXMgbG9hZGVkXHJcbiAgICBpZiAodGhpcy5jb21wbGV0ZSB8fCAodGhpcy5yZWFkeVN0YXRlID09PSA0KSB8fCAodGhpcy5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnKSkge1xyXG4gICAgICBzaW5nbGVJbWFnZUxvYWRlZCgpO1xyXG4gICAgfVxyXG4gICAgLy8gRm9yY2UgbG9hZCB0aGUgaW1hZ2VcclxuICAgIGVsc2Uge1xyXG4gICAgICAvLyBmaXggZm9yIElFLiBTZWUgaHR0cHM6Ly9jc3MtdHJpY2tzLmNvbS9zbmlwcGV0cy9qcXVlcnkvZml4aW5nLWxvYWQtaW4taWUtZm9yLWNhY2hlZC1pbWFnZXMvXHJcbiAgICAgIHZhciBzcmMgPSAkKHRoaXMpLmF0dHIoJ3NyYycpO1xyXG4gICAgICAkKHRoaXMpLmF0dHIoJ3NyYycsIHNyYyArICc/JyArIChuZXcgRGF0ZSgpLmdldFRpbWUoKSkpO1xyXG4gICAgICAkKHRoaXMpLm9uZSgnbG9hZCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHNpbmdsZUltYWdlTG9hZGVkKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBmdW5jdGlvbiBzaW5nbGVJbWFnZUxvYWRlZCgpIHtcclxuICAgIHVubG9hZGVkLS07XHJcbiAgICBpZiAodW5sb2FkZWQgPT09IDApIHtcclxuICAgICAgY2FsbGJhY2soKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbkZvdW5kYXRpb24uVGltZXIgPSBUaW1lcjtcclxuRm91bmRhdGlvbi5vbkltYWdlc0xvYWRlZCA9IG9uSW1hZ2VzTG9hZGVkO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbi8vKipXb3JrIGluc3BpcmVkIGJ5IG11bHRpcGxlIGpxdWVyeSBzd2lwZSBwbHVnaW5zKipcclxuLy8qKkRvbmUgYnkgWW9oYWkgQXJhcmF0ICoqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbihmdW5jdGlvbigkKSB7XHJcblxyXG4gICQuc3BvdFN3aXBlID0ge1xyXG4gICAgdmVyc2lvbjogJzEuMC4wJyxcclxuICAgIGVuYWJsZWQ6ICdvbnRvdWNoc3RhcnQnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCxcclxuICAgIHByZXZlbnREZWZhdWx0OiBmYWxzZSxcclxuICAgIG1vdmVUaHJlc2hvbGQ6IDc1LFxyXG4gICAgdGltZVRocmVzaG9sZDogMjAwXHJcbiAgfTtcclxuXHJcbiAgdmFyICAgc3RhcnRQb3NYLFxyXG4gICAgICAgIHN0YXJ0UG9zWSxcclxuICAgICAgICBzdGFydFRpbWUsXHJcbiAgICAgICAgZWxhcHNlZFRpbWUsXHJcbiAgICAgICAgaXNNb3ZpbmcgPSBmYWxzZTtcclxuXHJcbiAgZnVuY3Rpb24gb25Ub3VjaEVuZCgpIHtcclxuICAgIC8vICBhbGVydCh0aGlzKTtcclxuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgb25Ub3VjaE1vdmUpO1xyXG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIG9uVG91Y2hFbmQpO1xyXG4gICAgaXNNb3ZpbmcgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIG9uVG91Y2hNb3ZlKGUpIHtcclxuICAgIGlmICgkLnNwb3RTd2lwZS5wcmV2ZW50RGVmYXVsdCkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH1cclxuICAgIGlmKGlzTW92aW5nKSB7XHJcbiAgICAgIHZhciB4ID0gZS50b3VjaGVzWzBdLnBhZ2VYO1xyXG4gICAgICB2YXIgeSA9IGUudG91Y2hlc1swXS5wYWdlWTtcclxuICAgICAgdmFyIGR4ID0gc3RhcnRQb3NYIC0geDtcclxuICAgICAgdmFyIGR5ID0gc3RhcnRQb3NZIC0geTtcclxuICAgICAgdmFyIGRpcjtcclxuICAgICAgZWxhcHNlZFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0VGltZTtcclxuICAgICAgaWYoTWF0aC5hYnMoZHgpID49ICQuc3BvdFN3aXBlLm1vdmVUaHJlc2hvbGQgJiYgZWxhcHNlZFRpbWUgPD0gJC5zcG90U3dpcGUudGltZVRocmVzaG9sZCkge1xyXG4gICAgICAgIGRpciA9IGR4ID4gMCA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcbiAgICAgIH1cclxuICAgICAgLy8gZWxzZSBpZihNYXRoLmFicyhkeSkgPj0gJC5zcG90U3dpcGUubW92ZVRocmVzaG9sZCAmJiBlbGFwc2VkVGltZSA8PSAkLnNwb3RTd2lwZS50aW1lVGhyZXNob2xkKSB7XHJcbiAgICAgIC8vICAgZGlyID0gZHkgPiAwID8gJ2Rvd24nIDogJ3VwJztcclxuICAgICAgLy8gfVxyXG4gICAgICBpZihkaXIpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgb25Ub3VjaEVuZC5jYWxsKHRoaXMpO1xyXG4gICAgICAgICQodGhpcykudHJpZ2dlcignc3dpcGUnLCBkaXIpLnRyaWdnZXIoYHN3aXBlJHtkaXJ9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIG9uVG91Y2hTdGFydChlKSB7XHJcbiAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PSAxKSB7XHJcbiAgICAgIHN0YXJ0UG9zWCA9IGUudG91Y2hlc1swXS5wYWdlWDtcclxuICAgICAgc3RhcnRQb3NZID0gZS50b3VjaGVzWzBdLnBhZ2VZO1xyXG4gICAgICBpc01vdmluZyA9IHRydWU7XHJcbiAgICAgIHN0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIG9uVG91Y2hNb3ZlLCBmYWxzZSk7XHJcbiAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblRvdWNoRW5kLCBmYWxzZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBpbml0KCkge1xyXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyICYmIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uVG91Y2hTdGFydCwgZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gdGVhcmRvd24oKSB7XHJcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvblRvdWNoU3RhcnQpO1xyXG4gIH1cclxuXHJcbiAgJC5ldmVudC5zcGVjaWFsLnN3aXBlID0geyBzZXR1cDogaW5pdCB9O1xyXG5cclxuICAkLmVhY2goWydsZWZ0JywgJ3VwJywgJ2Rvd24nLCAncmlnaHQnXSwgZnVuY3Rpb24gKCkge1xyXG4gICAgJC5ldmVudC5zcGVjaWFsW2Bzd2lwZSR7dGhpc31gXSA9IHsgc2V0dXA6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICQodGhpcykub24oJ3N3aXBlJywgJC5ub29wKTtcclxuICAgIH0gfTtcclxuICB9KTtcclxufSkoalF1ZXJ5KTtcclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICogTWV0aG9kIGZvciBhZGRpbmcgcHN1ZWRvIGRyYWcgZXZlbnRzIHRvIGVsZW1lbnRzICpcclxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuIWZ1bmN0aW9uKCQpe1xyXG4gICQuZm4uYWRkVG91Y2ggPSBmdW5jdGlvbigpe1xyXG4gICAgdGhpcy5lYWNoKGZ1bmN0aW9uKGksZWwpe1xyXG4gICAgICAkKGVsKS5iaW5kKCd0b3VjaHN0YXJ0IHRvdWNobW92ZSB0b3VjaGVuZCB0b3VjaGNhbmNlbCcsZnVuY3Rpb24oKXtcclxuICAgICAgICAvL3dlIHBhc3MgdGhlIG9yaWdpbmFsIGV2ZW50IG9iamVjdCBiZWNhdXNlIHRoZSBqUXVlcnkgZXZlbnRcclxuICAgICAgICAvL29iamVjdCBpcyBub3JtYWxpemVkIHRvIHczYyBzcGVjcyBhbmQgZG9lcyBub3QgcHJvdmlkZSB0aGUgVG91Y2hMaXN0XHJcbiAgICAgICAgaGFuZGxlVG91Y2goZXZlbnQpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBoYW5kbGVUb3VjaCA9IGZ1bmN0aW9uKGV2ZW50KXtcclxuICAgICAgdmFyIHRvdWNoZXMgPSBldmVudC5jaGFuZ2VkVG91Y2hlcyxcclxuICAgICAgICAgIGZpcnN0ID0gdG91Y2hlc1swXSxcclxuICAgICAgICAgIGV2ZW50VHlwZXMgPSB7XHJcbiAgICAgICAgICAgIHRvdWNoc3RhcnQ6ICdtb3VzZWRvd24nLFxyXG4gICAgICAgICAgICB0b3VjaG1vdmU6ICdtb3VzZW1vdmUnLFxyXG4gICAgICAgICAgICB0b3VjaGVuZDogJ21vdXNldXAnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgdHlwZSA9IGV2ZW50VHlwZXNbZXZlbnQudHlwZV0sXHJcbiAgICAgICAgICBzaW11bGF0ZWRFdmVudFxyXG4gICAgICAgIDtcclxuXHJcbiAgICAgIGlmKCdNb3VzZUV2ZW50JyBpbiB3aW5kb3cgJiYgdHlwZW9mIHdpbmRvdy5Nb3VzZUV2ZW50ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgc2ltdWxhdGVkRXZlbnQgPSBuZXcgd2luZG93Lk1vdXNlRXZlbnQodHlwZSwge1xyXG4gICAgICAgICAgJ2J1YmJsZXMnOiB0cnVlLFxyXG4gICAgICAgICAgJ2NhbmNlbGFibGUnOiB0cnVlLFxyXG4gICAgICAgICAgJ3NjcmVlblgnOiBmaXJzdC5zY3JlZW5YLFxyXG4gICAgICAgICAgJ3NjcmVlblknOiBmaXJzdC5zY3JlZW5ZLFxyXG4gICAgICAgICAgJ2NsaWVudFgnOiBmaXJzdC5jbGllbnRYLFxyXG4gICAgICAgICAgJ2NsaWVudFknOiBmaXJzdC5jbGllbnRZXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2ltdWxhdGVkRXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnTW91c2VFdmVudCcpO1xyXG4gICAgICAgIHNpbXVsYXRlZEV2ZW50LmluaXRNb3VzZUV2ZW50KHR5cGUsIHRydWUsIHRydWUsIHdpbmRvdywgMSwgZmlyc3Quc2NyZWVuWCwgZmlyc3Quc2NyZWVuWSwgZmlyc3QuY2xpZW50WCwgZmlyc3QuY2xpZW50WSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIDAvKmxlZnQqLywgbnVsbCk7XHJcbiAgICAgIH1cclxuICAgICAgZmlyc3QudGFyZ2V0LmRpc3BhdGNoRXZlbnQoc2ltdWxhdGVkRXZlbnQpO1xyXG4gICAgfTtcclxuICB9O1xyXG59KGpRdWVyeSk7XHJcblxyXG5cclxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbi8vKipGcm9tIHRoZSBqUXVlcnkgTW9iaWxlIExpYnJhcnkqKlxyXG4vLyoqbmVlZCB0byByZWNyZWF0ZSBmdW5jdGlvbmFsaXR5KipcclxuLy8qKmFuZCB0cnkgdG8gaW1wcm92ZSBpZiBwb3NzaWJsZSoqXHJcbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5cclxuLyogUmVtb3ZpbmcgdGhlIGpRdWVyeSBmdW5jdGlvbiAqKioqXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5cclxuKGZ1bmN0aW9uKCAkLCB3aW5kb3csIHVuZGVmaW5lZCApIHtcclxuXHJcblx0dmFyICRkb2N1bWVudCA9ICQoIGRvY3VtZW50ICksXHJcblx0XHQvLyBzdXBwb3J0VG91Y2ggPSAkLm1vYmlsZS5zdXBwb3J0LnRvdWNoLFxyXG5cdFx0dG91Y2hTdGFydEV2ZW50ID0gJ3RvdWNoc3RhcnQnLy9zdXBwb3J0VG91Y2ggPyBcInRvdWNoc3RhcnRcIiA6IFwibW91c2Vkb3duXCIsXHJcblx0XHR0b3VjaFN0b3BFdmVudCA9ICd0b3VjaGVuZCcvL3N1cHBvcnRUb3VjaCA/IFwidG91Y2hlbmRcIiA6IFwibW91c2V1cFwiLFxyXG5cdFx0dG91Y2hNb3ZlRXZlbnQgPSAndG91Y2htb3ZlJy8vc3VwcG9ydFRvdWNoID8gXCJ0b3VjaG1vdmVcIiA6IFwibW91c2Vtb3ZlXCI7XHJcblxyXG5cdC8vIHNldHVwIG5ldyBldmVudCBzaG9ydGN1dHNcclxuXHQkLmVhY2goICggXCJ0b3VjaHN0YXJ0IHRvdWNobW92ZSB0b3VjaGVuZCBcIiArXHJcblx0XHRcInN3aXBlIHN3aXBlbGVmdCBzd2lwZXJpZ2h0XCIgKS5zcGxpdCggXCIgXCIgKSwgZnVuY3Rpb24oIGksIG5hbWUgKSB7XHJcblxyXG5cdFx0JC5mblsgbmFtZSBdID0gZnVuY3Rpb24oIGZuICkge1xyXG5cdFx0XHRyZXR1cm4gZm4gPyB0aGlzLmJpbmQoIG5hbWUsIGZuICkgOiB0aGlzLnRyaWdnZXIoIG5hbWUgKTtcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8galF1ZXJ5IDwgMS44XHJcblx0XHRpZiAoICQuYXR0ckZuICkge1xyXG5cdFx0XHQkLmF0dHJGblsgbmFtZSBdID0gdHJ1ZTtcclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblx0ZnVuY3Rpb24gdHJpZ2dlckN1c3RvbUV2ZW50KCBvYmosIGV2ZW50VHlwZSwgZXZlbnQsIGJ1YmJsZSApIHtcclxuXHRcdHZhciBvcmlnaW5hbFR5cGUgPSBldmVudC50eXBlO1xyXG5cdFx0ZXZlbnQudHlwZSA9IGV2ZW50VHlwZTtcclxuXHRcdGlmICggYnViYmxlICkge1xyXG5cdFx0XHQkLmV2ZW50LnRyaWdnZXIoIGV2ZW50LCB1bmRlZmluZWQsIG9iaiApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JC5ldmVudC5kaXNwYXRjaC5jYWxsKCBvYmosIGV2ZW50ICk7XHJcblx0XHR9XHJcblx0XHRldmVudC50eXBlID0gb3JpZ2luYWxUeXBlO1xyXG5cdH1cclxuXHJcblx0Ly8gYWxzbyBoYW5kbGVzIHRhcGhvbGRcclxuXHJcblx0Ly8gQWxzbyBoYW5kbGVzIHN3aXBlbGVmdCwgc3dpcGVyaWdodFxyXG5cdCQuZXZlbnQuc3BlY2lhbC5zd2lwZSA9IHtcclxuXHJcblx0XHQvLyBNb3JlIHRoYW4gdGhpcyBob3Jpem9udGFsIGRpc3BsYWNlbWVudCwgYW5kIHdlIHdpbGwgc3VwcHJlc3Mgc2Nyb2xsaW5nLlxyXG5cdFx0c2Nyb2xsU3VwcmVzc2lvblRocmVzaG9sZDogMzAsXHJcblxyXG5cdFx0Ly8gTW9yZSB0aW1lIHRoYW4gdGhpcywgYW5kIGl0IGlzbid0IGEgc3dpcGUuXHJcblx0XHRkdXJhdGlvblRocmVzaG9sZDogMTAwMCxcclxuXHJcblx0XHQvLyBTd2lwZSBob3Jpem9udGFsIGRpc3BsYWNlbWVudCBtdXN0IGJlIG1vcmUgdGhhbiB0aGlzLlxyXG5cdFx0aG9yaXpvbnRhbERpc3RhbmNlVGhyZXNob2xkOiB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA+PSAyID8gMTUgOiAzMCxcclxuXHJcblx0XHQvLyBTd2lwZSB2ZXJ0aWNhbCBkaXNwbGFjZW1lbnQgbXVzdCBiZSBsZXNzIHRoYW4gdGhpcy5cclxuXHRcdHZlcnRpY2FsRGlzdGFuY2VUaHJlc2hvbGQ6IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvID49IDIgPyAxNSA6IDMwLFxyXG5cclxuXHRcdGdldExvY2F0aW9uOiBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgd2luUGFnZVggPSB3aW5kb3cucGFnZVhPZmZzZXQsXHJcblx0XHRcdFx0d2luUGFnZVkgPSB3aW5kb3cucGFnZVlPZmZzZXQsXHJcblx0XHRcdFx0eCA9IGV2ZW50LmNsaWVudFgsXHJcblx0XHRcdFx0eSA9IGV2ZW50LmNsaWVudFk7XHJcblxyXG5cdFx0XHRpZiAoIGV2ZW50LnBhZ2VZID09PSAwICYmIE1hdGguZmxvb3IoIHkgKSA+IE1hdGguZmxvb3IoIGV2ZW50LnBhZ2VZICkgfHxcclxuXHRcdFx0XHRldmVudC5wYWdlWCA9PT0gMCAmJiBNYXRoLmZsb29yKCB4ICkgPiBNYXRoLmZsb29yKCBldmVudC5wYWdlWCApICkge1xyXG5cclxuXHRcdFx0XHQvLyBpT1M0IGNsaWVudFgvY2xpZW50WSBoYXZlIHRoZSB2YWx1ZSB0aGF0IHNob3VsZCBoYXZlIGJlZW5cclxuXHRcdFx0XHQvLyBpbiBwYWdlWC9wYWdlWS4gV2hpbGUgcGFnZVgvcGFnZS8gaGF2ZSB0aGUgdmFsdWUgMFxyXG5cdFx0XHRcdHggPSB4IC0gd2luUGFnZVg7XHJcblx0XHRcdFx0eSA9IHkgLSB3aW5QYWdlWTtcclxuXHRcdFx0fSBlbHNlIGlmICggeSA8ICggZXZlbnQucGFnZVkgLSB3aW5QYWdlWSkgfHwgeCA8ICggZXZlbnQucGFnZVggLSB3aW5QYWdlWCApICkge1xyXG5cclxuXHRcdFx0XHQvLyBTb21lIEFuZHJvaWQgYnJvd3NlcnMgaGF2ZSB0b3RhbGx5IGJvZ3VzIHZhbHVlcyBmb3IgY2xpZW50WC9ZXHJcblx0XHRcdFx0Ly8gd2hlbiBzY3JvbGxpbmcvem9vbWluZyBhIHBhZ2UuIERldGVjdGFibGUgc2luY2UgY2xpZW50WC9jbGllbnRZXHJcblx0XHRcdFx0Ly8gc2hvdWxkIG5ldmVyIGJlIHNtYWxsZXIgdGhhbiBwYWdlWC9wYWdlWSBtaW51cyBwYWdlIHNjcm9sbFxyXG5cdFx0XHRcdHggPSBldmVudC5wYWdlWCAtIHdpblBhZ2VYO1xyXG5cdFx0XHRcdHkgPSBldmVudC5wYWdlWSAtIHdpblBhZ2VZO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHg6IHgsXHJcblx0XHRcdFx0eTogeVxyXG5cdFx0XHR9O1xyXG5cdFx0fSxcclxuXHJcblx0XHRzdGFydDogZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgZGF0YSA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlcyA/XHJcblx0XHRcdFx0XHRldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXNbIDAgXSA6IGV2ZW50LFxyXG5cdFx0XHRcdGxvY2F0aW9uID0gJC5ldmVudC5zcGVjaWFsLnN3aXBlLmdldExvY2F0aW9uKCBkYXRhICk7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0XHRcdHRpbWU6ICggbmV3IERhdGUoKSApLmdldFRpbWUoKSxcclxuXHRcdFx0XHRcdFx0Y29vcmRzOiBbIGxvY2F0aW9uLngsIGxvY2F0aW9uLnkgXSxcclxuXHRcdFx0XHRcdFx0b3JpZ2luOiAkKCBldmVudC50YXJnZXQgKVxyXG5cdFx0XHRcdFx0fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0c3RvcDogZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgZGF0YSA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlcyA/XHJcblx0XHRcdFx0XHRldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXNbIDAgXSA6IGV2ZW50LFxyXG5cdFx0XHRcdGxvY2F0aW9uID0gJC5ldmVudC5zcGVjaWFsLnN3aXBlLmdldExvY2F0aW9uKCBkYXRhICk7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0XHRcdHRpbWU6ICggbmV3IERhdGUoKSApLmdldFRpbWUoKSxcclxuXHRcdFx0XHRcdFx0Y29vcmRzOiBbIGxvY2F0aW9uLngsIGxvY2F0aW9uLnkgXVxyXG5cdFx0XHRcdFx0fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0aGFuZGxlU3dpcGU6IGZ1bmN0aW9uKCBzdGFydCwgc3RvcCwgdGhpc09iamVjdCwgb3JpZ1RhcmdldCApIHtcclxuXHRcdFx0aWYgKCBzdG9wLnRpbWUgLSBzdGFydC50aW1lIDwgJC5ldmVudC5zcGVjaWFsLnN3aXBlLmR1cmF0aW9uVGhyZXNob2xkICYmXHJcblx0XHRcdFx0TWF0aC5hYnMoIHN0YXJ0LmNvb3Jkc1sgMCBdIC0gc3RvcC5jb29yZHNbIDAgXSApID4gJC5ldmVudC5zcGVjaWFsLnN3aXBlLmhvcml6b250YWxEaXN0YW5jZVRocmVzaG9sZCAmJlxyXG5cdFx0XHRcdE1hdGguYWJzKCBzdGFydC5jb29yZHNbIDEgXSAtIHN0b3AuY29vcmRzWyAxIF0gKSA8ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS52ZXJ0aWNhbERpc3RhbmNlVGhyZXNob2xkICkge1xyXG5cdFx0XHRcdHZhciBkaXJlY3Rpb24gPSBzdGFydC5jb29yZHNbMF0gPiBzdG9wLmNvb3Jkc1sgMCBdID8gXCJzd2lwZWxlZnRcIiA6IFwic3dpcGVyaWdodFwiO1xyXG5cclxuXHRcdFx0XHR0cmlnZ2VyQ3VzdG9tRXZlbnQoIHRoaXNPYmplY3QsIFwic3dpcGVcIiwgJC5FdmVudCggXCJzd2lwZVwiLCB7IHRhcmdldDogb3JpZ1RhcmdldCwgc3dpcGVzdGFydDogc3RhcnQsIHN3aXBlc3RvcDogc3RvcCB9KSwgdHJ1ZSApO1xyXG5cdFx0XHRcdHRyaWdnZXJDdXN0b21FdmVudCggdGhpc09iamVjdCwgZGlyZWN0aW9uLCQuRXZlbnQoIGRpcmVjdGlvbiwgeyB0YXJnZXQ6IG9yaWdUYXJnZXQsIHN3aXBlc3RhcnQ6IHN0YXJ0LCBzd2lwZXN0b3A6IHN0b3AgfSApLCB0cnVlICk7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdH0sXHJcblxyXG5cdFx0Ly8gVGhpcyBzZXJ2ZXMgYXMgYSBmbGFnIHRvIGVuc3VyZSB0aGF0IGF0IG1vc3Qgb25lIHN3aXBlIGV2ZW50IGV2ZW50IGlzXHJcblx0XHQvLyBpbiB3b3JrIGF0IGFueSBnaXZlbiB0aW1lXHJcblx0XHRldmVudEluUHJvZ3Jlc3M6IGZhbHNlLFxyXG5cclxuXHRcdHNldHVwOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIGV2ZW50cyxcclxuXHRcdFx0XHR0aGlzT2JqZWN0ID0gdGhpcyxcclxuXHRcdFx0XHQkdGhpcyA9ICQoIHRoaXNPYmplY3QgKSxcclxuXHRcdFx0XHRjb250ZXh0ID0ge307XHJcblxyXG5cdFx0XHQvLyBSZXRyaWV2ZSB0aGUgZXZlbnRzIGRhdGEgZm9yIHRoaXMgZWxlbWVudCBhbmQgYWRkIHRoZSBzd2lwZSBjb250ZXh0XHJcblx0XHRcdGV2ZW50cyA9ICQuZGF0YSggdGhpcywgXCJtb2JpbGUtZXZlbnRzXCIgKTtcclxuXHRcdFx0aWYgKCAhZXZlbnRzICkge1xyXG5cdFx0XHRcdGV2ZW50cyA9IHsgbGVuZ3RoOiAwIH07XHJcblx0XHRcdFx0JC5kYXRhKCB0aGlzLCBcIm1vYmlsZS1ldmVudHNcIiwgZXZlbnRzICk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZXZlbnRzLmxlbmd0aCsrO1xyXG5cdFx0XHRldmVudHMuc3dpcGUgPSBjb250ZXh0O1xyXG5cclxuXHRcdFx0Y29udGV4dC5zdGFydCA9IGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHJcblx0XHRcdFx0Ly8gQmFpbCBpZiB3ZSdyZSBhbHJlYWR5IHdvcmtpbmcgb24gYSBzd2lwZSBldmVudFxyXG5cdFx0XHRcdGlmICggJC5ldmVudC5zcGVjaWFsLnN3aXBlLmV2ZW50SW5Qcm9ncmVzcyApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0JC5ldmVudC5zcGVjaWFsLnN3aXBlLmV2ZW50SW5Qcm9ncmVzcyA9IHRydWU7XHJcblxyXG5cdFx0XHRcdHZhciBzdG9wLFxyXG5cdFx0XHRcdFx0c3RhcnQgPSAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuc3RhcnQoIGV2ZW50ICksXHJcblx0XHRcdFx0XHRvcmlnVGFyZ2V0ID0gZXZlbnQudGFyZ2V0LFxyXG5cdFx0XHRcdFx0ZW1pdHRlZCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0XHRjb250ZXh0Lm1vdmUgPSBmdW5jdGlvbiggZXZlbnQgKSB7XHJcblx0XHRcdFx0XHRpZiAoICFzdGFydCB8fCBldmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQoKSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHN0b3AgPSAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuc3RvcCggZXZlbnQgKTtcclxuXHRcdFx0XHRcdGlmICggIWVtaXR0ZWQgKSB7XHJcblx0XHRcdFx0XHRcdGVtaXR0ZWQgPSAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuaGFuZGxlU3dpcGUoIHN0YXJ0LCBzdG9wLCB0aGlzT2JqZWN0LCBvcmlnVGFyZ2V0ICk7XHJcblx0XHRcdFx0XHRcdGlmICggZW1pdHRlZCApIHtcclxuXHJcblx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgdGhlIGNvbnRleHQgdG8gbWFrZSB3YXkgZm9yIHRoZSBuZXh0IHN3aXBlIGV2ZW50XHJcblx0XHRcdFx0XHRcdFx0JC5ldmVudC5zcGVjaWFsLnN3aXBlLmV2ZW50SW5Qcm9ncmVzcyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvLyBwcmV2ZW50IHNjcm9sbGluZ1xyXG5cdFx0XHRcdFx0aWYgKCBNYXRoLmFicyggc3RhcnQuY29vcmRzWyAwIF0gLSBzdG9wLmNvb3Jkc1sgMCBdICkgPiAkLmV2ZW50LnNwZWNpYWwuc3dpcGUuc2Nyb2xsU3VwcmVzc2lvblRocmVzaG9sZCApIHtcclxuXHRcdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRjb250ZXh0LnN0b3AgPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0ZW1pdHRlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBSZXNldCB0aGUgY29udGV4dCB0byBtYWtlIHdheSBmb3IgdGhlIG5leHQgc3dpcGUgZXZlbnRcclxuXHRcdFx0XHRcdFx0JC5ldmVudC5zcGVjaWFsLnN3aXBlLmV2ZW50SW5Qcm9ncmVzcyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHQkZG9jdW1lbnQub2ZmKCB0b3VjaE1vdmVFdmVudCwgY29udGV4dC5tb3ZlICk7XHJcblx0XHRcdFx0XHRcdGNvbnRleHQubW92ZSA9IG51bGw7XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0JGRvY3VtZW50Lm9uKCB0b3VjaE1vdmVFdmVudCwgY29udGV4dC5tb3ZlIClcclxuXHRcdFx0XHRcdC5vbmUoIHRvdWNoU3RvcEV2ZW50LCBjb250ZXh0LnN0b3AgKTtcclxuXHRcdFx0fTtcclxuXHRcdFx0JHRoaXMub24oIHRvdWNoU3RhcnRFdmVudCwgY29udGV4dC5zdGFydCApO1xyXG5cdFx0fSxcclxuXHJcblx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBldmVudHMsIGNvbnRleHQ7XHJcblxyXG5cdFx0XHRldmVudHMgPSAkLmRhdGEoIHRoaXMsIFwibW9iaWxlLWV2ZW50c1wiICk7XHJcblx0XHRcdGlmICggZXZlbnRzICkge1xyXG5cdFx0XHRcdGNvbnRleHQgPSBldmVudHMuc3dpcGU7XHJcblx0XHRcdFx0ZGVsZXRlIGV2ZW50cy5zd2lwZTtcclxuXHRcdFx0XHRldmVudHMubGVuZ3RoLS07XHJcblx0XHRcdFx0aWYgKCBldmVudHMubGVuZ3RoID09PSAwICkge1xyXG5cdFx0XHRcdFx0JC5yZW1vdmVEYXRhKCB0aGlzLCBcIm1vYmlsZS1ldmVudHNcIiApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBjb250ZXh0ICkge1xyXG5cdFx0XHRcdGlmICggY29udGV4dC5zdGFydCApIHtcclxuXHRcdFx0XHRcdCQoIHRoaXMgKS5vZmYoIHRvdWNoU3RhcnRFdmVudCwgY29udGV4dC5zdGFydCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGNvbnRleHQubW92ZSApIHtcclxuXHRcdFx0XHRcdCRkb2N1bWVudC5vZmYoIHRvdWNoTW92ZUV2ZW50LCBjb250ZXh0Lm1vdmUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBjb250ZXh0LnN0b3AgKSB7XHJcblx0XHRcdFx0XHQkZG9jdW1lbnQub2ZmKCB0b3VjaFN0b3BFdmVudCwgY29udGV4dC5zdG9wICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxuXHQkLmVhY2goe1xyXG5cdFx0c3dpcGVsZWZ0OiBcInN3aXBlLmxlZnRcIixcclxuXHRcdHN3aXBlcmlnaHQ6IFwic3dpcGUucmlnaHRcIlxyXG5cdH0sIGZ1bmN0aW9uKCBldmVudCwgc291cmNlRXZlbnQgKSB7XHJcblxyXG5cdFx0JC5ldmVudC5zcGVjaWFsWyBldmVudCBdID0ge1xyXG5cdFx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0JCggdGhpcyApLmJpbmQoIHNvdXJjZUV2ZW50LCAkLm5vb3AgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdCQoIHRoaXMgKS51bmJpbmQoIHNvdXJjZUV2ZW50ICk7XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0fSk7XHJcbn0pKCBqUXVlcnksIHRoaXMgKTtcclxuKi9cclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbmNvbnN0IE11dGF0aW9uT2JzZXJ2ZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gIHZhciBwcmVmaXhlcyA9IFsnV2ViS2l0JywgJ01veicsICdPJywgJ01zJywgJyddO1xyXG4gIGZvciAodmFyIGk9MDsgaSA8IHByZWZpeGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBpZiAoYCR7cHJlZml4ZXNbaV19TXV0YXRpb25PYnNlcnZlcmAgaW4gd2luZG93KSB7XHJcbiAgICAgIHJldHVybiB3aW5kb3dbYCR7cHJlZml4ZXNbaV19TXV0YXRpb25PYnNlcnZlcmBdO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gZmFsc2U7XHJcbn0oKSk7XHJcblxyXG5jb25zdCB0cmlnZ2VycyA9IChlbCwgdHlwZSkgPT4ge1xyXG4gIGVsLmRhdGEodHlwZSkuc3BsaXQoJyAnKS5mb3JFYWNoKGlkID0+IHtcclxuICAgICQoYCMke2lkfWApWyB0eXBlID09PSAnY2xvc2UnID8gJ3RyaWdnZXInIDogJ3RyaWdnZXJIYW5kbGVyJ10oYCR7dHlwZX0uemYudHJpZ2dlcmAsIFtlbF0pO1xyXG4gIH0pO1xyXG59O1xyXG4vLyBFbGVtZW50cyB3aXRoIFtkYXRhLW9wZW5dIHdpbGwgcmV2ZWFsIGEgcGx1Z2luIHRoYXQgc3VwcG9ydHMgaXQgd2hlbiBjbGlja2VkLlxyXG4kKGRvY3VtZW50KS5vbignY2xpY2suemYudHJpZ2dlcicsICdbZGF0YS1vcGVuXScsIGZ1bmN0aW9uKCkge1xyXG4gIHRyaWdnZXJzKCQodGhpcyksICdvcGVuJyk7XHJcbn0pO1xyXG5cclxuLy8gRWxlbWVudHMgd2l0aCBbZGF0YS1jbG9zZV0gd2lsbCBjbG9zZSBhIHBsdWdpbiB0aGF0IHN1cHBvcnRzIGl0IHdoZW4gY2xpY2tlZC5cclxuLy8gSWYgdXNlZCB3aXRob3V0IGEgdmFsdWUgb24gW2RhdGEtY2xvc2VdLCB0aGUgZXZlbnQgd2lsbCBidWJibGUsIGFsbG93aW5nIGl0IHRvIGNsb3NlIGEgcGFyZW50IGNvbXBvbmVudC5cclxuJChkb2N1bWVudCkub24oJ2NsaWNrLnpmLnRyaWdnZXInLCAnW2RhdGEtY2xvc2VdJywgZnVuY3Rpb24oKSB7XHJcbiAgbGV0IGlkID0gJCh0aGlzKS5kYXRhKCdjbG9zZScpO1xyXG4gIGlmIChpZCkge1xyXG4gICAgdHJpZ2dlcnMoJCh0aGlzKSwgJ2Nsb3NlJyk7XHJcbiAgfVxyXG4gIGVsc2Uge1xyXG4gICAgJCh0aGlzKS50cmlnZ2VyKCdjbG9zZS56Zi50cmlnZ2VyJyk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIEVsZW1lbnRzIHdpdGggW2RhdGEtdG9nZ2xlXSB3aWxsIHRvZ2dsZSBhIHBsdWdpbiB0aGF0IHN1cHBvcnRzIGl0IHdoZW4gY2xpY2tlZC5cclxuJChkb2N1bWVudCkub24oJ2NsaWNrLnpmLnRyaWdnZXInLCAnW2RhdGEtdG9nZ2xlXScsIGZ1bmN0aW9uKCkge1xyXG4gIGxldCBpZCA9ICQodGhpcykuZGF0YSgndG9nZ2xlJyk7XHJcbiAgaWYgKGlkKSB7XHJcbiAgICB0cmlnZ2VycygkKHRoaXMpLCAndG9nZ2xlJyk7XHJcbiAgfSBlbHNlIHtcclxuICAgICQodGhpcykudHJpZ2dlcigndG9nZ2xlLnpmLnRyaWdnZXInKTtcclxuICB9XHJcbn0pO1xyXG5cclxuLy8gRWxlbWVudHMgd2l0aCBbZGF0YS1jbG9zYWJsZV0gd2lsbCByZXNwb25kIHRvIGNsb3NlLnpmLnRyaWdnZXIgZXZlbnRzLlxyXG4kKGRvY3VtZW50KS5vbignY2xvc2UuemYudHJpZ2dlcicsICdbZGF0YS1jbG9zYWJsZV0nLCBmdW5jdGlvbihlKXtcclxuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gIGxldCBhbmltYXRpb24gPSAkKHRoaXMpLmRhdGEoJ2Nsb3NhYmxlJyk7XHJcblxyXG4gIGlmKGFuaW1hdGlvbiAhPT0gJycpe1xyXG4gICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZU91dCgkKHRoaXMpLCBhbmltYXRpb24sIGZ1bmN0aW9uKCkge1xyXG4gICAgICAkKHRoaXMpLnRyaWdnZXIoJ2Nsb3NlZC56ZicpO1xyXG4gICAgfSk7XHJcbiAgfWVsc2V7XHJcbiAgICAkKHRoaXMpLmZhZGVPdXQoKS50cmlnZ2VyKCdjbG9zZWQuemYnKTtcclxuICB9XHJcbn0pO1xyXG5cclxuJChkb2N1bWVudCkub24oJ2ZvY3VzLnpmLnRyaWdnZXIgYmx1ci56Zi50cmlnZ2VyJywgJ1tkYXRhLXRvZ2dsZS1mb2N1c10nLCBmdW5jdGlvbigpIHtcclxuICBsZXQgaWQgPSAkKHRoaXMpLmRhdGEoJ3RvZ2dsZS1mb2N1cycpO1xyXG4gICQoYCMke2lkfWApLnRyaWdnZXJIYW5kbGVyKCd0b2dnbGUuemYudHJpZ2dlcicsIFskKHRoaXMpXSk7XHJcbn0pO1xyXG5cclxuLyoqXHJcbiogRmlyZXMgb25jZSBhZnRlciBhbGwgb3RoZXIgc2NyaXB0cyBoYXZlIGxvYWRlZFxyXG4qIEBmdW5jdGlvblxyXG4qIEBwcml2YXRlXHJcbiovXHJcbiQod2luZG93KS5vbignbG9hZCcsICgpID0+IHtcclxuICBjaGVja0xpc3RlbmVycygpO1xyXG59KTtcclxuXHJcbmZ1bmN0aW9uIGNoZWNrTGlzdGVuZXJzKCkge1xyXG4gIGV2ZW50c0xpc3RlbmVyKCk7XHJcbiAgcmVzaXplTGlzdGVuZXIoKTtcclxuICBzY3JvbGxMaXN0ZW5lcigpO1xyXG4gIG11dGF0ZUxpc3RlbmVyKCk7XHJcbiAgY2xvc2VtZUxpc3RlbmVyKCk7XHJcbn1cclxuXHJcbi8vKioqKioqKiogb25seSBmaXJlcyB0aGlzIGZ1bmN0aW9uIG9uY2Ugb24gbG9hZCwgaWYgdGhlcmUncyBzb21ldGhpbmcgdG8gd2F0Y2ggKioqKioqKipcclxuZnVuY3Rpb24gY2xvc2VtZUxpc3RlbmVyKHBsdWdpbk5hbWUpIHtcclxuICB2YXIgeWV0aUJveGVzID0gJCgnW2RhdGEteWV0aS1ib3hdJyksXHJcbiAgICAgIHBsdWdOYW1lcyA9IFsnZHJvcGRvd24nLCAndG9vbHRpcCcsICdyZXZlYWwnXTtcclxuXHJcbiAgaWYocGx1Z2luTmFtZSl7XHJcbiAgICBpZih0eXBlb2YgcGx1Z2luTmFtZSA9PT0gJ3N0cmluZycpe1xyXG4gICAgICBwbHVnTmFtZXMucHVzaChwbHVnaW5OYW1lKTtcclxuICAgIH1lbHNlIGlmKHR5cGVvZiBwbHVnaW5OYW1lID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgcGx1Z2luTmFtZVswXSA9PT0gJ3N0cmluZycpe1xyXG4gICAgICBwbHVnTmFtZXMuY29uY2F0KHBsdWdpbk5hbWUpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1BsdWdpbiBuYW1lcyBtdXN0IGJlIHN0cmluZ3MnKTtcclxuICAgIH1cclxuICB9XHJcbiAgaWYoeWV0aUJveGVzLmxlbmd0aCl7XHJcbiAgICBsZXQgbGlzdGVuZXJzID0gcGx1Z05hbWVzLm1hcCgobmFtZSkgPT4ge1xyXG4gICAgICByZXR1cm4gYGNsb3NlbWUuemYuJHtuYW1lfWA7XHJcbiAgICB9KS5qb2luKCcgJyk7XHJcblxyXG4gICAgJCh3aW5kb3cpLm9mZihsaXN0ZW5lcnMpLm9uKGxpc3RlbmVycywgZnVuY3Rpb24oZSwgcGx1Z2luSWQpe1xyXG4gICAgICBsZXQgcGx1Z2luID0gZS5uYW1lc3BhY2Uuc3BsaXQoJy4nKVswXTtcclxuICAgICAgbGV0IHBsdWdpbnMgPSAkKGBbZGF0YS0ke3BsdWdpbn1dYCkubm90KGBbZGF0YS15ZXRpLWJveD1cIiR7cGx1Z2luSWR9XCJdYCk7XHJcblxyXG4gICAgICBwbHVnaW5zLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgICBsZXQgX3RoaXMgPSAkKHRoaXMpO1xyXG5cclxuICAgICAgICBfdGhpcy50cmlnZ2VySGFuZGxlcignY2xvc2UuemYudHJpZ2dlcicsIFtfdGhpc10pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVzaXplTGlzdGVuZXIoZGVib3VuY2Upe1xyXG4gIGxldCB0aW1lcixcclxuICAgICAgJG5vZGVzID0gJCgnW2RhdGEtcmVzaXplXScpO1xyXG4gIGlmKCRub2Rlcy5sZW5ndGgpe1xyXG4gICAgJCh3aW5kb3cpLm9mZigncmVzaXplLnpmLnRyaWdnZXInKVxyXG4gICAgLm9uKCdyZXNpemUuemYudHJpZ2dlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgaWYgKHRpbWVyKSB7IGNsZWFyVGltZW91dCh0aW1lcik7IH1cclxuXHJcbiAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuICAgICAgICBpZighTXV0YXRpb25PYnNlcnZlcil7Ly9mYWxsYmFjayBmb3IgSUUgOVxyXG4gICAgICAgICAgJG5vZGVzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgJCh0aGlzKS50cmlnZ2VySGFuZGxlcigncmVzaXplbWUuemYudHJpZ2dlcicpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vdHJpZ2dlciBhbGwgbGlzdGVuaW5nIGVsZW1lbnRzIGFuZCBzaWduYWwgYSByZXNpemUgZXZlbnRcclxuICAgICAgICAkbm9kZXMuYXR0cignZGF0YS1ldmVudHMnLCBcInJlc2l6ZVwiKTtcclxuICAgICAgfSwgZGVib3VuY2UgfHwgMTApOy8vZGVmYXVsdCB0aW1lIHRvIGVtaXQgcmVzaXplIGV2ZW50XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNjcm9sbExpc3RlbmVyKGRlYm91bmNlKXtcclxuICBsZXQgdGltZXIsXHJcbiAgICAgICRub2RlcyA9ICQoJ1tkYXRhLXNjcm9sbF0nKTtcclxuICBpZigkbm9kZXMubGVuZ3RoKXtcclxuICAgICQod2luZG93KS5vZmYoJ3Njcm9sbC56Zi50cmlnZ2VyJylcclxuICAgIC5vbignc2Nyb2xsLnpmLnRyaWdnZXInLCBmdW5jdGlvbihlKXtcclxuICAgICAgaWYodGltZXIpeyBjbGVhclRpbWVvdXQodGltZXIpOyB9XHJcblxyXG4gICAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcbiAgICAgICAgaWYoIU11dGF0aW9uT2JzZXJ2ZXIpey8vZmFsbGJhY2sgZm9yIElFIDlcclxuICAgICAgICAgICRub2Rlcy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICQodGhpcykudHJpZ2dlckhhbmRsZXIoJ3Njcm9sbG1lLnpmLnRyaWdnZXInKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvL3RyaWdnZXIgYWxsIGxpc3RlbmluZyBlbGVtZW50cyBhbmQgc2lnbmFsIGEgc2Nyb2xsIGV2ZW50XHJcbiAgICAgICAgJG5vZGVzLmF0dHIoJ2RhdGEtZXZlbnRzJywgXCJzY3JvbGxcIik7XHJcbiAgICAgIH0sIGRlYm91bmNlIHx8IDEwKTsvL2RlZmF1bHQgdGltZSB0byBlbWl0IHNjcm9sbCBldmVudFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBtdXRhdGVMaXN0ZW5lcihkZWJvdW5jZSkge1xyXG4gICAgbGV0ICRub2RlcyA9ICQoJ1tkYXRhLW11dGF0ZV0nKTtcclxuICAgIGlmICgkbm9kZXMubGVuZ3RoICYmIE11dGF0aW9uT2JzZXJ2ZXIpe1xyXG5cdFx0XHQvL3RyaWdnZXIgYWxsIGxpc3RlbmluZyBlbGVtZW50cyBhbmQgc2lnbmFsIGEgbXV0YXRlIGV2ZW50XHJcbiAgICAgIC8vbm8gSUUgOSBvciAxMFxyXG5cdFx0XHQkbm9kZXMuZWFjaChmdW5jdGlvbiAoKSB7XHJcblx0XHRcdCAgJCh0aGlzKS50cmlnZ2VySGFuZGxlcignbXV0YXRlbWUuemYudHJpZ2dlcicpO1xyXG5cdFx0XHR9KTtcclxuICAgIH1cclxuIH1cclxuXHJcbmZ1bmN0aW9uIGV2ZW50c0xpc3RlbmVyKCkge1xyXG4gIGlmKCFNdXRhdGlvbk9ic2VydmVyKXsgcmV0dXJuIGZhbHNlOyB9XHJcbiAgbGV0IG5vZGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtcmVzaXplXSwgW2RhdGEtc2Nyb2xsXSwgW2RhdGEtbXV0YXRlXScpO1xyXG5cclxuICAvL2VsZW1lbnQgY2FsbGJhY2tcclxuICB2YXIgbGlzdGVuaW5nRWxlbWVudHNNdXRhdGlvbiA9IGZ1bmN0aW9uIChtdXRhdGlvblJlY29yZHNMaXN0KSB7XHJcbiAgICAgIHZhciAkdGFyZ2V0ID0gJChtdXRhdGlvblJlY29yZHNMaXN0WzBdLnRhcmdldCk7XHJcblxyXG5cdCAgLy90cmlnZ2VyIHRoZSBldmVudCBoYW5kbGVyIGZvciB0aGUgZWxlbWVudCBkZXBlbmRpbmcgb24gdHlwZVxyXG4gICAgICBzd2l0Y2ggKG11dGF0aW9uUmVjb3Jkc0xpc3RbMF0udHlwZSkge1xyXG5cclxuICAgICAgICBjYXNlIFwiYXR0cmlidXRlc1wiOlxyXG4gICAgICAgICAgaWYgKCR0YXJnZXQuYXR0cihcImRhdGEtZXZlbnRzXCIpID09PSBcInNjcm9sbFwiICYmIG11dGF0aW9uUmVjb3Jkc0xpc3RbMF0uYXR0cmlidXRlTmFtZSA9PT0gXCJkYXRhLWV2ZW50c1wiKSB7XHJcblx0XHQgIFx0JHRhcmdldC50cmlnZ2VySGFuZGxlcignc2Nyb2xsbWUuemYudHJpZ2dlcicsIFskdGFyZ2V0LCB3aW5kb3cucGFnZVlPZmZzZXRdKTtcclxuXHRcdCAgfVxyXG5cdFx0ICBpZiAoJHRhcmdldC5hdHRyKFwiZGF0YS1ldmVudHNcIikgPT09IFwicmVzaXplXCIgJiYgbXV0YXRpb25SZWNvcmRzTGlzdFswXS5hdHRyaWJ1dGVOYW1lID09PSBcImRhdGEtZXZlbnRzXCIpIHtcclxuXHRcdCAgXHQkdGFyZ2V0LnRyaWdnZXJIYW5kbGVyKCdyZXNpemVtZS56Zi50cmlnZ2VyJywgWyR0YXJnZXRdKTtcclxuXHRcdCAgIH1cclxuXHRcdCAgaWYgKG11dGF0aW9uUmVjb3Jkc0xpc3RbMF0uYXR0cmlidXRlTmFtZSA9PT0gXCJzdHlsZVwiKSB7XHJcblx0XHRcdCAgJHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtbXV0YXRlXVwiKS5hdHRyKFwiZGF0YS1ldmVudHNcIixcIm11dGF0ZVwiKTtcclxuXHRcdFx0ICAkdGFyZ2V0LmNsb3Nlc3QoXCJbZGF0YS1tdXRhdGVdXCIpLnRyaWdnZXJIYW5kbGVyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJywgWyR0YXJnZXQuY2xvc2VzdChcIltkYXRhLW11dGF0ZV1cIildKTtcclxuXHRcdCAgfVxyXG5cdFx0ICBicmVhaztcclxuXHJcbiAgICAgICAgY2FzZSBcImNoaWxkTGlzdFwiOlxyXG5cdFx0ICAkdGFyZ2V0LmNsb3Nlc3QoXCJbZGF0YS1tdXRhdGVdXCIpLmF0dHIoXCJkYXRhLWV2ZW50c1wiLFwibXV0YXRlXCIpO1xyXG5cdFx0ICAkdGFyZ2V0LmNsb3Nlc3QoXCJbZGF0YS1tdXRhdGVdXCIpLnRyaWdnZXJIYW5kbGVyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJywgWyR0YXJnZXQuY2xvc2VzdChcIltkYXRhLW11dGF0ZV1cIildKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIC8vbm90aGluZ1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChub2Rlcy5sZW5ndGgpIHtcclxuICAgICAgLy9mb3IgZWFjaCBlbGVtZW50IHRoYXQgbmVlZHMgdG8gbGlzdGVuIGZvciByZXNpemluZywgc2Nyb2xsaW5nLCBvciBtdXRhdGlvbiBhZGQgYSBzaW5nbGUgb2JzZXJ2ZXJcclxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPD0gbm9kZXMubGVuZ3RoIC0gMTsgaSsrKSB7XHJcbiAgICAgICAgdmFyIGVsZW1lbnRPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGxpc3RlbmluZ0VsZW1lbnRzTXV0YXRpb24pO1xyXG4gICAgICAgIGVsZW1lbnRPYnNlcnZlci5vYnNlcnZlKG5vZGVzW2ldLCB7IGF0dHJpYnV0ZXM6IHRydWUsIGNoaWxkTGlzdDogdHJ1ZSwgY2hhcmFjdGVyRGF0YTogZmFsc2UsIHN1YnRyZWU6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogW1wiZGF0YS1ldmVudHNcIiwgXCJzdHlsZVwiXSB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLy8gW1BIXVxyXG4vLyBGb3VuZGF0aW9uLkNoZWNrV2F0Y2hlcnMgPSBjaGVja1dhdGNoZXJzO1xyXG5Gb3VuZGF0aW9uLklIZWFyWW91ID0gY2hlY2tMaXN0ZW5lcnM7XHJcbi8vIEZvdW5kYXRpb24uSVNlZVlvdSA9IHNjcm9sbExpc3RlbmVyO1xyXG4vLyBGb3VuZGF0aW9uLklGZWVsWW91ID0gY2xvc2VtZUxpc3RlbmVyO1xyXG5cclxufShqUXVlcnkpO1xyXG5cclxuLy8gZnVuY3Rpb24gZG9tTXV0YXRpb25PYnNlcnZlcihkZWJvdW5jZSkge1xyXG4vLyAgIC8vICEhISBUaGlzIGlzIGNvbWluZyBzb29uIGFuZCBuZWVkcyBtb3JlIHdvcms7IG5vdCBhY3RpdmUgICEhISAvL1xyXG4vLyAgIHZhciB0aW1lcixcclxuLy8gICBub2RlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLW11dGF0ZV0nKTtcclxuLy8gICAvL1xyXG4vLyAgIGlmIChub2Rlcy5sZW5ndGgpIHtcclxuLy8gICAgIC8vIHZhciBNdXRhdGlvbk9ic2VydmVyID0gKGZ1bmN0aW9uICgpIHtcclxuLy8gICAgIC8vICAgdmFyIHByZWZpeGVzID0gWydXZWJLaXQnLCAnTW96JywgJ08nLCAnTXMnLCAnJ107XHJcbi8vICAgICAvLyAgIGZvciAodmFyIGk9MDsgaSA8IHByZWZpeGVzLmxlbmd0aDsgaSsrKSB7XHJcbi8vICAgICAvLyAgICAgaWYgKHByZWZpeGVzW2ldICsgJ011dGF0aW9uT2JzZXJ2ZXInIGluIHdpbmRvdykge1xyXG4vLyAgICAgLy8gICAgICAgcmV0dXJuIHdpbmRvd1twcmVmaXhlc1tpXSArICdNdXRhdGlvbk9ic2VydmVyJ107XHJcbi8vICAgICAvLyAgICAgfVxyXG4vLyAgICAgLy8gICB9XHJcbi8vICAgICAvLyAgIHJldHVybiBmYWxzZTtcclxuLy8gICAgIC8vIH0oKSk7XHJcbi8vXHJcbi8vXHJcbi8vICAgICAvL2ZvciB0aGUgYm9keSwgd2UgbmVlZCB0byBsaXN0ZW4gZm9yIGFsbCBjaGFuZ2VzIGVmZmVjdGluZyB0aGUgc3R5bGUgYW5kIGNsYXNzIGF0dHJpYnV0ZXNcclxuLy8gICAgIHZhciBib2R5T2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihib2R5TXV0YXRpb24pO1xyXG4vLyAgICAgYm9keU9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUsIGNoYXJhY3RlckRhdGE6IGZhbHNlLCBzdWJ0cmVlOnRydWUsIGF0dHJpYnV0ZUZpbHRlcjpbXCJzdHlsZVwiLCBcImNsYXNzXCJdfSk7XHJcbi8vXHJcbi8vXHJcbi8vICAgICAvL2JvZHkgY2FsbGJhY2tcclxuLy8gICAgIGZ1bmN0aW9uIGJvZHlNdXRhdGlvbihtdXRhdGUpIHtcclxuLy8gICAgICAgLy90cmlnZ2VyIGFsbCBsaXN0ZW5pbmcgZWxlbWVudHMgYW5kIHNpZ25hbCBhIG11dGF0aW9uIGV2ZW50XHJcbi8vICAgICAgIGlmICh0aW1lcikgeyBjbGVhclRpbWVvdXQodGltZXIpOyB9XHJcbi8vXHJcbi8vICAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuLy8gICAgICAgICBib2R5T2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG4vLyAgICAgICAgICQoJ1tkYXRhLW11dGF0ZV0nKS5hdHRyKCdkYXRhLWV2ZW50cycsXCJtdXRhdGVcIik7XHJcbi8vICAgICAgIH0sIGRlYm91bmNlIHx8IDE1MCk7XHJcbi8vICAgICB9XHJcbi8vICAgfVxyXG4vLyB9XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogQWJpZGUgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uYWJpZGVcclxuICovXHJcblxyXG5jbGFzcyBBYmlkZSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBBYmlkZS5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgQWJpZGUjaW5pdFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBhZGQgdGhlIHRyaWdnZXIgdG8uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgID0gJC5leHRlbmQoe30sIEFiaWRlLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0FiaWRlJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgQWJpZGUgcGx1Z2luIGFuZCBjYWxscyBmdW5jdGlvbnMgdG8gZ2V0IEFiaWRlIGZ1bmN0aW9uaW5nIG9uIGxvYWQuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHRoaXMuJGlucHV0cyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnaW5wdXQsIHRleHRhcmVhLCBzZWxlY3QnKTtcclxuXHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIGV2ZW50cyBmb3IgQWJpZGUuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy5hYmlkZScpXHJcbiAgICAgIC5vbigncmVzZXQuemYuYWJpZGUnLCAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZXNldEZvcm0oKTtcclxuICAgICAgfSlcclxuICAgICAgLm9uKCdzdWJtaXQuemYuYWJpZGUnLCAoKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudmFsaWRhdGVGb3JtKCk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudmFsaWRhdGVPbiA9PT0gJ2ZpZWxkQ2hhbmdlJykge1xyXG4gICAgICB0aGlzLiRpbnB1dHNcclxuICAgICAgICAub2ZmKCdjaGFuZ2UuemYuYWJpZGUnKVxyXG4gICAgICAgIC5vbignY2hhbmdlLnpmLmFiaWRlJywgKGUpID0+IHtcclxuICAgICAgICAgIHRoaXMudmFsaWRhdGVJbnB1dCgkKGUudGFyZ2V0KSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5saXZlVmFsaWRhdGUpIHtcclxuICAgICAgdGhpcy4kaW5wdXRzXHJcbiAgICAgICAgLm9mZignaW5wdXQuemYuYWJpZGUnKVxyXG4gICAgICAgIC5vbignaW5wdXQuemYuYWJpZGUnLCAoZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy52YWxpZGF0ZUlucHV0KCQoZS50YXJnZXQpKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnZhbGlkYXRlT25CbHVyKSB7XHJcbiAgICAgIHRoaXMuJGlucHV0c1xyXG4gICAgICAgIC5vZmYoJ2JsdXIuemYuYWJpZGUnKVxyXG4gICAgICAgIC5vbignYmx1ci56Zi5hYmlkZScsIChlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZhbGlkYXRlSW5wdXQoJChlLnRhcmdldCkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsbHMgbmVjZXNzYXJ5IGZ1bmN0aW9ucyB0byB1cGRhdGUgQWJpZGUgdXBvbiBET00gY2hhbmdlXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcmVmbG93KCkge1xyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIHdoZXRoZXIgb3Igbm90IGEgZm9ybSBlbGVtZW50IGhhcyB0aGUgcmVxdWlyZWQgYXR0cmlidXRlIGFuZCBpZiBpdCdzIGNoZWNrZWQgb3Igbm90XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGNoZWNrIGZvciByZXF1aXJlZCBhdHRyaWJ1dGVcclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQm9vbGVhbiB2YWx1ZSBkZXBlbmRzIG9uIHdoZXRoZXIgb3Igbm90IGF0dHJpYnV0ZSBpcyBjaGVja2VkIG9yIGVtcHR5XHJcbiAgICovXHJcbiAgcmVxdWlyZWRDaGVjaygkZWwpIHtcclxuICAgIGlmICghJGVsLmF0dHIoJ3JlcXVpcmVkJykpIHJldHVybiB0cnVlO1xyXG5cclxuICAgIHZhciBpc0dvb2QgPSB0cnVlO1xyXG5cclxuICAgIHN3aXRjaCAoJGVsWzBdLnR5cGUpIHtcclxuICAgICAgY2FzZSAnY2hlY2tib3gnOlxyXG4gICAgICAgIGlzR29vZCA9ICRlbFswXS5jaGVja2VkO1xyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgY2FzZSAnc2VsZWN0JzpcclxuICAgICAgY2FzZSAnc2VsZWN0LW9uZSc6XHJcbiAgICAgIGNhc2UgJ3NlbGVjdC1tdWx0aXBsZSc6XHJcbiAgICAgICAgdmFyIG9wdCA9ICRlbC5maW5kKCdvcHRpb246c2VsZWN0ZWQnKTtcclxuICAgICAgICBpZiAoIW9wdC5sZW5ndGggfHwgIW9wdC52YWwoKSkgaXNHb29kID0gZmFsc2U7XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIGlmKCEkZWwudmFsKCkgfHwgISRlbC52YWwoKS5sZW5ndGgpIGlzR29vZCA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBpc0dvb2Q7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCYXNlZCBvbiAkZWwsIGdldCB0aGUgZmlyc3QgZWxlbWVudCB3aXRoIHNlbGVjdG9yIGluIHRoaXMgb3JkZXI6XHJcbiAgICogMS4gVGhlIGVsZW1lbnQncyBkaXJlY3Qgc2libGluZygncykuXHJcbiAgICogMy4gVGhlIGVsZW1lbnQncyBwYXJlbnQncyBjaGlsZHJlbi5cclxuICAgKlxyXG4gICAqIFRoaXMgYWxsb3dzIGZvciBtdWx0aXBsZSBmb3JtIGVycm9ycyBwZXIgaW5wdXQsIHRob3VnaCBpZiBub25lIGFyZSBmb3VuZCwgbm8gZm9ybSBlcnJvcnMgd2lsbCBiZSBzaG93bi5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAkZWwgLSBqUXVlcnkgb2JqZWN0IHRvIHVzZSBhcyByZWZlcmVuY2UgdG8gZmluZCB0aGUgZm9ybSBlcnJvciBzZWxlY3Rvci5cclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBqUXVlcnkgb2JqZWN0IHdpdGggdGhlIHNlbGVjdG9yLlxyXG4gICAqL1xyXG4gIGZpbmRGb3JtRXJyb3IoJGVsKSB7XHJcbiAgICB2YXIgJGVycm9yID0gJGVsLnNpYmxpbmdzKHRoaXMub3B0aW9ucy5mb3JtRXJyb3JTZWxlY3Rvcik7XHJcblxyXG4gICAgaWYgKCEkZXJyb3IubGVuZ3RoKSB7XHJcbiAgICAgICRlcnJvciA9ICRlbC5wYXJlbnQoKS5maW5kKHRoaXMub3B0aW9ucy5mb3JtRXJyb3JTZWxlY3Rvcik7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuICRlcnJvcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGlzIG9yZGVyOlxyXG4gICAqIDIuIFRoZSA8bGFiZWw+IHdpdGggdGhlIGF0dHJpYnV0ZSBgW2Zvcj1cInNvbWVJbnB1dElkXCJdYFxyXG4gICAqIDMuIFRoZSBgLmNsb3Nlc3QoKWAgPGxhYmVsPlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHtPYmplY3R9ICRlbCAtIGpRdWVyeSBvYmplY3QgdG8gY2hlY2sgZm9yIHJlcXVpcmVkIGF0dHJpYnV0ZVxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBCb29sZWFuIHZhbHVlIGRlcGVuZHMgb24gd2hldGhlciBvciBub3QgYXR0cmlidXRlIGlzIGNoZWNrZWQgb3IgZW1wdHlcclxuICAgKi9cclxuICBmaW5kTGFiZWwoJGVsKSB7XHJcbiAgICB2YXIgaWQgPSAkZWxbMF0uaWQ7XHJcbiAgICB2YXIgJGxhYmVsID0gdGhpcy4kZWxlbWVudC5maW5kKGBsYWJlbFtmb3I9XCIke2lkfVwiXWApO1xyXG5cclxuICAgIGlmICghJGxhYmVsLmxlbmd0aCkge1xyXG4gICAgICByZXR1cm4gJGVsLmNsb3Nlc3QoJ2xhYmVsJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuICRsYWJlbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgc2V0IG9mIGxhYmVscyBhc3NvY2lhdGVkIHdpdGggYSBzZXQgb2YgcmFkaW8gZWxzIGluIHRoaXMgb3JkZXJcclxuICAgKiAyLiBUaGUgPGxhYmVsPiB3aXRoIHRoZSBhdHRyaWJ1dGUgYFtmb3I9XCJzb21lSW5wdXRJZFwiXWBcclxuICAgKiAzLiBUaGUgYC5jbG9zZXN0KClgIDxsYWJlbD5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAkZWwgLSBqUXVlcnkgb2JqZWN0IHRvIGNoZWNrIGZvciByZXF1aXJlZCBhdHRyaWJ1dGVcclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQm9vbGVhbiB2YWx1ZSBkZXBlbmRzIG9uIHdoZXRoZXIgb3Igbm90IGF0dHJpYnV0ZSBpcyBjaGVja2VkIG9yIGVtcHR5XHJcbiAgICovXHJcbiAgZmluZFJhZGlvTGFiZWxzKCRlbHMpIHtcclxuICAgIHZhciBsYWJlbHMgPSAkZWxzLm1hcCgoaSwgZWwpID0+IHtcclxuICAgICAgdmFyIGlkID0gZWwuaWQ7XHJcbiAgICAgIHZhciAkbGFiZWwgPSB0aGlzLiRlbGVtZW50LmZpbmQoYGxhYmVsW2Zvcj1cIiR7aWR9XCJdYCk7XHJcblxyXG4gICAgICBpZiAoISRsYWJlbC5sZW5ndGgpIHtcclxuICAgICAgICAkbGFiZWwgPSAkKGVsKS5jbG9zZXN0KCdsYWJlbCcpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiAkbGFiZWxbMF07XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gJChsYWJlbHMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyB0aGUgQ1NTIGVycm9yIGNsYXNzIGFzIHNwZWNpZmllZCBieSB0aGUgQWJpZGUgc2V0dGluZ3MgdG8gdGhlIGxhYmVsLCBpbnB1dCwgYW5kIHRoZSBmb3JtXHJcbiAgICogQHBhcmFtIHtPYmplY3R9ICRlbCAtIGpRdWVyeSBvYmplY3QgdG8gYWRkIHRoZSBjbGFzcyB0b1xyXG4gICAqL1xyXG4gIGFkZEVycm9yQ2xhc3NlcygkZWwpIHtcclxuICAgIHZhciAkbGFiZWwgPSB0aGlzLmZpbmRMYWJlbCgkZWwpO1xyXG4gICAgdmFyICRmb3JtRXJyb3IgPSB0aGlzLmZpbmRGb3JtRXJyb3IoJGVsKTtcclxuXHJcbiAgICBpZiAoJGxhYmVsLmxlbmd0aCkge1xyXG4gICAgICAkbGFiZWwuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmxhYmVsRXJyb3JDbGFzcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCRmb3JtRXJyb3IubGVuZ3RoKSB7XHJcbiAgICAgICRmb3JtRXJyb3IuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmZvcm1FcnJvckNsYXNzKTtcclxuICAgIH1cclxuXHJcbiAgICAkZWwuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmlucHV0RXJyb3JDbGFzcykuYXR0cignZGF0YS1pbnZhbGlkJywgJycpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIENTUyBlcnJvciBjbGFzc2VzIGV0YyBmcm9tIGFuIGVudGlyZSByYWRpbyBidXR0b24gZ3JvdXBcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZ3JvdXBOYW1lIC0gQSBzdHJpbmcgdGhhdCBzcGVjaWZpZXMgdGhlIG5hbWUgb2YgYSByYWRpbyBidXR0b24gZ3JvdXBcclxuICAgKlxyXG4gICAqL1xyXG5cclxuICByZW1vdmVSYWRpb0Vycm9yQ2xhc3Nlcyhncm91cE5hbWUpIHtcclxuICAgIHZhciAkZWxzID0gdGhpcy4kZWxlbWVudC5maW5kKGA6cmFkaW9bbmFtZT1cIiR7Z3JvdXBOYW1lfVwiXWApO1xyXG4gICAgdmFyICRsYWJlbHMgPSB0aGlzLmZpbmRSYWRpb0xhYmVscygkZWxzKTtcclxuICAgIHZhciAkZm9ybUVycm9ycyA9IHRoaXMuZmluZEZvcm1FcnJvcigkZWxzKTtcclxuXHJcbiAgICBpZiAoJGxhYmVscy5sZW5ndGgpIHtcclxuICAgICAgJGxhYmVscy5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMubGFiZWxFcnJvckNsYXNzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGZvcm1FcnJvcnMubGVuZ3RoKSB7XHJcbiAgICAgICRmb3JtRXJyb3JzLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5mb3JtRXJyb3JDbGFzcyk7XHJcbiAgICB9XHJcblxyXG4gICAgJGVscy5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuaW5wdXRFcnJvckNsYXNzKS5yZW1vdmVBdHRyKCdkYXRhLWludmFsaWQnKTtcclxuXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmVzIENTUyBlcnJvciBjbGFzcyBhcyBzcGVjaWZpZWQgYnkgdGhlIEFiaWRlIHNldHRpbmdzIGZyb20gdGhlIGxhYmVsLCBpbnB1dCwgYW5kIHRoZSBmb3JtXHJcbiAgICogQHBhcmFtIHtPYmplY3R9ICRlbCAtIGpRdWVyeSBvYmplY3QgdG8gcmVtb3ZlIHRoZSBjbGFzcyBmcm9tXHJcbiAgICovXHJcbiAgcmVtb3ZlRXJyb3JDbGFzc2VzKCRlbCkge1xyXG4gICAgLy8gcmFkaW9zIG5lZWQgdG8gY2xlYXIgYWxsIG9mIHRoZSBlbHNcclxuICAgIGlmKCRlbFswXS50eXBlID09ICdyYWRpbycpIHtcclxuICAgICAgcmV0dXJuIHRoaXMucmVtb3ZlUmFkaW9FcnJvckNsYXNzZXMoJGVsLmF0dHIoJ25hbWUnKSk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyICRsYWJlbCA9IHRoaXMuZmluZExhYmVsKCRlbCk7XHJcbiAgICB2YXIgJGZvcm1FcnJvciA9IHRoaXMuZmluZEZvcm1FcnJvcigkZWwpO1xyXG5cclxuICAgIGlmICgkbGFiZWwubGVuZ3RoKSB7XHJcbiAgICAgICRsYWJlbC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMubGFiZWxFcnJvckNsYXNzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGZvcm1FcnJvci5sZW5ndGgpIHtcclxuICAgICAgJGZvcm1FcnJvci5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuZm9ybUVycm9yQ2xhc3MpO1xyXG4gICAgfVxyXG5cclxuICAgICRlbC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuaW5wdXRFcnJvckNsYXNzKS5yZW1vdmVBdHRyKCdkYXRhLWludmFsaWQnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdvZXMgdGhyb3VnaCBhIGZvcm0gdG8gZmluZCBpbnB1dHMgYW5kIHByb2NlZWRzIHRvIHZhbGlkYXRlIHRoZW0gaW4gd2F5cyBzcGVjaWZpYyB0byB0aGVpciB0eXBlXHJcbiAgICogQGZpcmVzIEFiaWRlI2ludmFsaWRcclxuICAgKiBAZmlyZXMgQWJpZGUjdmFsaWRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gdmFsaWRhdGUsIHNob3VsZCBiZSBhbiBIVE1MIGlucHV0XHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IGdvb2RUb0dvIC0gSWYgdGhlIGlucHV0IGlzIHZhbGlkIG9yIG5vdC5cclxuICAgKi9cclxuICB2YWxpZGF0ZUlucHV0KCRlbCkge1xyXG4gICAgdmFyIGNsZWFyUmVxdWlyZSA9IHRoaXMucmVxdWlyZWRDaGVjaygkZWwpLFxyXG4gICAgICAgIHZhbGlkYXRlZCA9IGZhbHNlLFxyXG4gICAgICAgIGN1c3RvbVZhbGlkYXRvciA9IHRydWUsXHJcbiAgICAgICAgdmFsaWRhdG9yID0gJGVsLmF0dHIoJ2RhdGEtdmFsaWRhdG9yJyksXHJcbiAgICAgICAgZXF1YWxUbyA9IHRydWU7XHJcblxyXG4gICAgLy8gZG9uJ3QgdmFsaWRhdGUgaWdub3JlZCBpbnB1dHMgb3IgaGlkZGVuIGlucHV0c1xyXG4gICAgaWYgKCRlbC5pcygnW2RhdGEtYWJpZGUtaWdub3JlXScpIHx8ICRlbC5pcygnW3R5cGU9XCJoaWRkZW5cIl0nKSkge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2ggKCRlbFswXS50eXBlKSB7XHJcbiAgICAgIGNhc2UgJ3JhZGlvJzpcclxuICAgICAgICB2YWxpZGF0ZWQgPSB0aGlzLnZhbGlkYXRlUmFkaW8oJGVsLmF0dHIoJ25hbWUnKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICBjYXNlICdjaGVja2JveCc6XHJcbiAgICAgICAgdmFsaWRhdGVkID0gY2xlYXJSZXF1aXJlO1xyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgY2FzZSAnc2VsZWN0JzpcclxuICAgICAgY2FzZSAnc2VsZWN0LW9uZSc6XHJcbiAgICAgIGNhc2UgJ3NlbGVjdC1tdWx0aXBsZSc6XHJcbiAgICAgICAgdmFsaWRhdGVkID0gY2xlYXJSZXF1aXJlO1xyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICB2YWxpZGF0ZWQgPSB0aGlzLnZhbGlkYXRlVGV4dCgkZWwpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh2YWxpZGF0b3IpIHtcclxuICAgICAgY3VzdG9tVmFsaWRhdG9yID0gdGhpcy5tYXRjaFZhbGlkYXRpb24oJGVsLCB2YWxpZGF0b3IsICRlbC5hdHRyKCdyZXF1aXJlZCcpKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGVsLmF0dHIoJ2RhdGEtZXF1YWx0bycpKSB7XHJcbiAgICAgIGVxdWFsVG8gPSB0aGlzLm9wdGlvbnMudmFsaWRhdG9ycy5lcXVhbFRvKCRlbCk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHZhciBnb29kVG9HbyA9IFtjbGVhclJlcXVpcmUsIHZhbGlkYXRlZCwgY3VzdG9tVmFsaWRhdG9yLCBlcXVhbFRvXS5pbmRleE9mKGZhbHNlKSA9PT0gLTE7XHJcbiAgICB2YXIgbWVzc2FnZSA9IChnb29kVG9HbyA/ICd2YWxpZCcgOiAnaW52YWxpZCcpICsgJy56Zi5hYmlkZSc7XHJcblxyXG4gICAgaWYgKGdvb2RUb0dvKSB7XHJcbiAgICAgIC8vIFJlLXZhbGlkYXRlIGlucHV0cyB0aGF0IGRlcGVuZCBvbiB0aGlzIG9uZSB3aXRoIGVxdWFsdG9cclxuICAgICAgY29uc3QgZGVwZW5kZW50RWxlbWVudHMgPSB0aGlzLiRlbGVtZW50LmZpbmQoYFtkYXRhLWVxdWFsdG89XCIkeyRlbC5hdHRyKCdpZCcpfVwiXWApO1xyXG4gICAgICBpZiAoZGVwZW5kZW50RWxlbWVudHMubGVuZ3RoKSB7XHJcbiAgICAgICAgbGV0IF90aGlzID0gdGhpcztcclxuICAgICAgICBkZXBlbmRlbnRFbGVtZW50cy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKCQodGhpcykudmFsKCkpIHtcclxuICAgICAgICAgICAgX3RoaXMudmFsaWRhdGVJbnB1dCgkKHRoaXMpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXNbZ29vZFRvR28gPyAncmVtb3ZlRXJyb3JDbGFzc2VzJyA6ICdhZGRFcnJvckNsYXNzZXMnXSgkZWwpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgaW5wdXQgaXMgZG9uZSBjaGVja2luZyBmb3IgdmFsaWRhdGlvbi4gRXZlbnQgdHJpZ2dlciBpcyBlaXRoZXIgYHZhbGlkLnpmLmFiaWRlYCBvciBgaW52YWxpZC56Zi5hYmlkZWBcclxuICAgICAqIFRyaWdnZXIgaW5jbHVkZXMgdGhlIERPTSBlbGVtZW50IG9mIHRoZSBpbnB1dC5cclxuICAgICAqIEBldmVudCBBYmlkZSN2YWxpZFxyXG4gICAgICogQGV2ZW50IEFiaWRlI2ludmFsaWRcclxuICAgICAqL1xyXG4gICAgJGVsLnRyaWdnZXIobWVzc2FnZSwgWyRlbF0pO1xyXG5cclxuICAgIHJldHVybiBnb29kVG9HbztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdvZXMgdGhyb3VnaCBhIGZvcm0gYW5kIGlmIHRoZXJlIGFyZSBhbnkgaW52YWxpZCBpbnB1dHMsIGl0IHdpbGwgZGlzcGxheSB0aGUgZm9ybSBlcnJvciBlbGVtZW50XHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IG5vRXJyb3IgLSB0cnVlIGlmIG5vIGVycm9ycyB3ZXJlIGRldGVjdGVkLi4uXHJcbiAgICogQGZpcmVzIEFiaWRlI2Zvcm12YWxpZFxyXG4gICAqIEBmaXJlcyBBYmlkZSNmb3JtaW52YWxpZFxyXG4gICAqL1xyXG4gIHZhbGlkYXRlRm9ybSgpIHtcclxuICAgIHZhciBhY2MgPSBbXTtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kaW5wdXRzLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgIGFjYy5wdXNoKF90aGlzLnZhbGlkYXRlSW5wdXQoJCh0aGlzKSkpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdmFyIG5vRXJyb3IgPSBhY2MuaW5kZXhPZihmYWxzZSkgPT09IC0xO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtYWJpZGUtZXJyb3JdJykuY3NzKCdkaXNwbGF5JywgKG5vRXJyb3IgPyAnbm9uZScgOiAnYmxvY2snKSk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBmb3JtIGlzIGZpbmlzaGVkIHZhbGlkYXRpbmcuIEV2ZW50IHRyaWdnZXIgaXMgZWl0aGVyIGBmb3JtdmFsaWQuemYuYWJpZGVgIG9yIGBmb3JtaW52YWxpZC56Zi5hYmlkZWAuXHJcbiAgICAgKiBUcmlnZ2VyIGluY2x1ZGVzIHRoZSBlbGVtZW50IG9mIHRoZSBmb3JtLlxyXG4gICAgICogQGV2ZW50IEFiaWRlI2Zvcm12YWxpZFxyXG4gICAgICogQGV2ZW50IEFiaWRlI2Zvcm1pbnZhbGlkXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigobm9FcnJvciA/ICdmb3JtdmFsaWQnIDogJ2Zvcm1pbnZhbGlkJykgKyAnLnpmLmFiaWRlJywgW3RoaXMuJGVsZW1lbnRdKTtcclxuXHJcbiAgICByZXR1cm4gbm9FcnJvcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERldGVybWluZXMgd2hldGhlciBvciBhIG5vdCBhIHRleHQgaW5wdXQgaXMgdmFsaWQgYmFzZWQgb24gdGhlIHBhdHRlcm4gc3BlY2lmaWVkIGluIHRoZSBhdHRyaWJ1dGUuIElmIG5vIG1hdGNoaW5nIHBhdHRlcm4gaXMgZm91bmQsIHJldHVybnMgdHJ1ZS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gJGVsIC0galF1ZXJ5IG9iamVjdCB0byB2YWxpZGF0ZSwgc2hvdWxkIGJlIGEgdGV4dCBpbnB1dCBIVE1MIGVsZW1lbnRcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0dGVybiAtIHN0cmluZyB2YWx1ZSBvZiBvbmUgb2YgdGhlIFJlZ0V4IHBhdHRlcm5zIGluIEFiaWRlLm9wdGlvbnMucGF0dGVybnNcclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQm9vbGVhbiB2YWx1ZSBkZXBlbmRzIG9uIHdoZXRoZXIgb3Igbm90IHRoZSBpbnB1dCB2YWx1ZSBtYXRjaGVzIHRoZSBwYXR0ZXJuIHNwZWNpZmllZFxyXG4gICAqL1xyXG4gIHZhbGlkYXRlVGV4dCgkZWwsIHBhdHRlcm4pIHtcclxuICAgIC8vIEEgcGF0dGVybiBjYW4gYmUgcGFzc2VkIHRvIHRoaXMgZnVuY3Rpb24sIG9yIGl0IHdpbGwgYmUgaW5mZXJlZCBmcm9tIHRoZSBpbnB1dCdzIFwicGF0dGVyblwiIGF0dHJpYnV0ZSwgb3IgaXQncyBcInR5cGVcIiBhdHRyaWJ1dGVcclxuICAgIHBhdHRlcm4gPSAocGF0dGVybiB8fCAkZWwuYXR0cigncGF0dGVybicpIHx8ICRlbC5hdHRyKCd0eXBlJykpO1xyXG4gICAgdmFyIGlucHV0VGV4dCA9ICRlbC52YWwoKTtcclxuICAgIHZhciB2YWxpZCA9IGZhbHNlO1xyXG5cclxuICAgIGlmIChpbnB1dFRleHQubGVuZ3RoKSB7XHJcbiAgICAgIC8vIElmIHRoZSBwYXR0ZXJuIGF0dHJpYnV0ZSBvbiB0aGUgZWxlbWVudCBpcyBpbiBBYmlkZSdzIGxpc3Qgb2YgcGF0dGVybnMsIHRoZW4gdGVzdCB0aGF0IHJlZ2V4cFxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnBhdHRlcm5zLmhhc093blByb3BlcnR5KHBhdHRlcm4pKSB7XHJcbiAgICAgICAgdmFsaWQgPSB0aGlzLm9wdGlvbnMucGF0dGVybnNbcGF0dGVybl0udGVzdChpbnB1dFRleHQpO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIElmIHRoZSBwYXR0ZXJuIG5hbWUgaXNuJ3QgYWxzbyB0aGUgdHlwZSBhdHRyaWJ1dGUgb2YgdGhlIGZpZWxkLCB0aGVuIHRlc3QgaXQgYXMgYSByZWdleHBcclxuICAgICAgZWxzZSBpZiAocGF0dGVybiAhPT0gJGVsLmF0dHIoJ3R5cGUnKSkge1xyXG4gICAgICAgIHZhbGlkID0gbmV3IFJlZ0V4cChwYXR0ZXJuKS50ZXN0KGlucHV0VGV4dCk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgdmFsaWQgPSB0cnVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBBbiBlbXB0eSBmaWVsZCBpcyB2YWxpZCBpZiBpdCdzIG5vdCByZXF1aXJlZFxyXG4gICAgZWxzZSBpZiAoISRlbC5wcm9wKCdyZXF1aXJlZCcpKSB7XHJcbiAgICAgIHZhbGlkID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdmFsaWQ7XHJcbiAgIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIG9yIGEgbm90IGEgcmFkaW8gaW5wdXQgaXMgdmFsaWQgYmFzZWQgb24gd2hldGhlciBvciBub3QgaXQgaXMgcmVxdWlyZWQgYW5kIHNlbGVjdGVkLiBBbHRob3VnaCB0aGUgZnVuY3Rpb24gdGFyZ2V0cyBhIHNpbmdsZSBgPGlucHV0PmAsIGl0IHZhbGlkYXRlcyBieSBjaGVja2luZyB0aGUgYHJlcXVpcmVkYCBhbmQgYGNoZWNrZWRgIHByb3BlcnRpZXMgb2YgYWxsIHJhZGlvIGJ1dHRvbnMgaW4gaXRzIGdyb3VwLlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBncm91cE5hbWUgLSBBIHN0cmluZyB0aGF0IHNwZWNpZmllcyB0aGUgbmFtZSBvZiBhIHJhZGlvIGJ1dHRvbiBncm91cFxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBCb29sZWFuIHZhbHVlIGRlcGVuZHMgb24gd2hldGhlciBvciBub3QgYXQgbGVhc3Qgb25lIHJhZGlvIGlucHV0IGhhcyBiZWVuIHNlbGVjdGVkIChpZiBpdCdzIHJlcXVpcmVkKVxyXG4gICAqL1xyXG4gIHZhbGlkYXRlUmFkaW8oZ3JvdXBOYW1lKSB7XHJcbiAgICAvLyBJZiBhdCBsZWFzdCBvbmUgcmFkaW8gaW4gdGhlIGdyb3VwIGhhcyB0aGUgYHJlcXVpcmVkYCBhdHRyaWJ1dGUsIHRoZSBncm91cCBpcyBjb25zaWRlcmVkIHJlcXVpcmVkXHJcbiAgICAvLyBQZXIgVzNDIHNwZWMsIGFsbCByYWRpbyBidXR0b25zIGluIGEgZ3JvdXAgc2hvdWxkIGhhdmUgYHJlcXVpcmVkYCwgYnV0IHdlJ3JlIGJlaW5nIG5pY2VcclxuICAgIHZhciAkZ3JvdXAgPSB0aGlzLiRlbGVtZW50LmZpbmQoYDpyYWRpb1tuYW1lPVwiJHtncm91cE5hbWV9XCJdYCk7XHJcbiAgICB2YXIgdmFsaWQgPSBmYWxzZSwgcmVxdWlyZWQgPSBmYWxzZTtcclxuXHJcbiAgICAvLyBGb3IgdGhlIGdyb3VwIHRvIGJlIHJlcXVpcmVkLCBhdCBsZWFzdCBvbmUgcmFkaW8gbmVlZHMgdG8gYmUgcmVxdWlyZWRcclxuICAgICRncm91cC5lYWNoKChpLCBlKSA9PiB7XHJcbiAgICAgIGlmICgkKGUpLmF0dHIoJ3JlcXVpcmVkJykpIHtcclxuICAgICAgICByZXF1aXJlZCA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgaWYoIXJlcXVpcmVkKSB2YWxpZD10cnVlO1xyXG5cclxuICAgIGlmICghdmFsaWQpIHtcclxuICAgICAgLy8gRm9yIHRoZSBncm91cCB0byBiZSB2YWxpZCwgYXQgbGVhc3Qgb25lIHJhZGlvIG5lZWRzIHRvIGJlIGNoZWNrZWRcclxuICAgICAgJGdyb3VwLmVhY2goKGksIGUpID0+IHtcclxuICAgICAgICBpZiAoJChlKS5wcm9wKCdjaGVja2VkJykpIHtcclxuICAgICAgICAgIHZhbGlkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdmFsaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXRlcm1pbmVzIGlmIGEgc2VsZWN0ZWQgaW5wdXQgcGFzc2VzIGEgY3VzdG9tIHZhbGlkYXRpb24gZnVuY3Rpb24uIE11bHRpcGxlIHZhbGlkYXRpb25zIGNhbiBiZSB1c2VkLCBpZiBwYXNzZWQgdG8gdGhlIGVsZW1lbnQgd2l0aCBgZGF0YS12YWxpZGF0b3I9XCJmb28gYmFyIGJhelwiYCBpbiBhIHNwYWNlIHNlcGFyYXRlZCBsaXN0ZWQuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9ICRlbCAtIGpRdWVyeSBpbnB1dCBlbGVtZW50LlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB2YWxpZGF0b3JzIC0gYSBzdHJpbmcgb2YgZnVuY3Rpb24gbmFtZXMgbWF0Y2hpbmcgZnVuY3Rpb25zIGluIHRoZSBBYmlkZS5vcHRpb25zLnZhbGlkYXRvcnMgb2JqZWN0LlxyXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gcmVxdWlyZWQgLSBzZWxmIGV4cGxhbmF0b3J5P1xyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSAtIHRydWUgaWYgdmFsaWRhdGlvbnMgcGFzc2VkLlxyXG4gICAqL1xyXG4gIG1hdGNoVmFsaWRhdGlvbigkZWwsIHZhbGlkYXRvcnMsIHJlcXVpcmVkKSB7XHJcbiAgICByZXF1aXJlZCA9IHJlcXVpcmVkID8gdHJ1ZSA6IGZhbHNlO1xyXG5cclxuICAgIHZhciBjbGVhciA9IHZhbGlkYXRvcnMuc3BsaXQoJyAnKS5tYXAoKHYpID0+IHtcclxuICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy52YWxpZGF0b3JzW3ZdKCRlbCwgcmVxdWlyZWQsICRlbC5wYXJlbnQoKSk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBjbGVhci5pbmRleE9mKGZhbHNlKSA9PT0gLTE7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNldHMgZm9ybSBpbnB1dHMgYW5kIHN0eWxlc1xyXG4gICAqIEBmaXJlcyBBYmlkZSNmb3JtcmVzZXRcclxuICAgKi9cclxuICByZXNldEZvcm0oKSB7XHJcbiAgICB2YXIgJGZvcm0gPSB0aGlzLiRlbGVtZW50LFxyXG4gICAgICAgIG9wdHMgPSB0aGlzLm9wdGlvbnM7XHJcblxyXG4gICAgJChgLiR7b3B0cy5sYWJlbEVycm9yQ2xhc3N9YCwgJGZvcm0pLm5vdCgnc21hbGwnKS5yZW1vdmVDbGFzcyhvcHRzLmxhYmVsRXJyb3JDbGFzcyk7XHJcbiAgICAkKGAuJHtvcHRzLmlucHV0RXJyb3JDbGFzc31gLCAkZm9ybSkubm90KCdzbWFsbCcpLnJlbW92ZUNsYXNzKG9wdHMuaW5wdXRFcnJvckNsYXNzKTtcclxuICAgICQoYCR7b3B0cy5mb3JtRXJyb3JTZWxlY3Rvcn0uJHtvcHRzLmZvcm1FcnJvckNsYXNzfWApLnJlbW92ZUNsYXNzKG9wdHMuZm9ybUVycm9yQ2xhc3MpO1xyXG4gICAgJGZvcm0uZmluZCgnW2RhdGEtYWJpZGUtZXJyb3JdJykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcclxuICAgICQoJzppbnB1dCcsICRmb3JtKS5ub3QoJzpidXR0b24sIDpzdWJtaXQsIDpyZXNldCwgOmhpZGRlbiwgOnJhZGlvLCA6Y2hlY2tib3gsIFtkYXRhLWFiaWRlLWlnbm9yZV0nKS52YWwoJycpLnJlbW92ZUF0dHIoJ2RhdGEtaW52YWxpZCcpO1xyXG4gICAgJCgnOmlucHV0OnJhZGlvJywgJGZvcm0pLm5vdCgnW2RhdGEtYWJpZGUtaWdub3JlXScpLnByb3AoJ2NoZWNrZWQnLGZhbHNlKS5yZW1vdmVBdHRyKCdkYXRhLWludmFsaWQnKTtcclxuICAgICQoJzppbnB1dDpjaGVja2JveCcsICRmb3JtKS5ub3QoJ1tkYXRhLWFiaWRlLWlnbm9yZV0nKS5wcm9wKCdjaGVja2VkJyxmYWxzZSkucmVtb3ZlQXR0cignZGF0YS1pbnZhbGlkJyk7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIGZvcm0gaGFzIGJlZW4gcmVzZXQuXHJcbiAgICAgKiBAZXZlbnQgQWJpZGUjZm9ybXJlc2V0XHJcbiAgICAgKi9cclxuICAgICRmb3JtLnRyaWdnZXIoJ2Zvcm1yZXNldC56Zi5hYmlkZScsIFskZm9ybV0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgQWJpZGUuXHJcbiAgICogUmVtb3ZlcyBlcnJvciBzdHlsZXMgYW5kIGNsYXNzZXMgZnJvbSBlbGVtZW50cywgd2l0aG91dCByZXNldHRpbmcgdGhlaXIgdmFsdWVzLlxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAub2ZmKCcuYWJpZGUnKVxyXG4gICAgICAuZmluZCgnW2RhdGEtYWJpZGUtZXJyb3JdJylcclxuICAgICAgICAuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcclxuXHJcbiAgICB0aGlzLiRpbnB1dHNcclxuICAgICAgLm9mZignLmFiaWRlJylcclxuICAgICAgLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMucmVtb3ZlRXJyb3JDbGFzc2VzKCQodGhpcykpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVmYXVsdCBzZXR0aW5ncyBmb3IgcGx1Z2luXHJcbiAqL1xyXG5BYmlkZS5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBUaGUgZGVmYXVsdCBldmVudCB0byB2YWxpZGF0ZSBpbnB1dHMuIENoZWNrYm94ZXMgYW5kIHJhZGlvcyB2YWxpZGF0ZSBpbW1lZGlhdGVseS5cclxuICAgKiBSZW1vdmUgb3IgY2hhbmdlIHRoaXMgdmFsdWUgZm9yIG1hbnVhbCB2YWxpZGF0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnZmllbGRDaGFuZ2UnXHJcbiAgICovXHJcbiAgdmFsaWRhdGVPbjogJ2ZpZWxkQ2hhbmdlJyxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgdG8gYmUgYXBwbGllZCB0byBpbnB1dCBsYWJlbHMgb24gZmFpbGVkIHZhbGlkYXRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdpcy1pbnZhbGlkLWxhYmVsJ1xyXG4gICAqL1xyXG4gIGxhYmVsRXJyb3JDbGFzczogJ2lzLWludmFsaWQtbGFiZWwnLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyB0byBiZSBhcHBsaWVkIHRvIGlucHV0cyBvbiBmYWlsZWQgdmFsaWRhdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2lzLWludmFsaWQtaW5wdXQnXHJcbiAgICovXHJcbiAgaW5wdXRFcnJvckNsYXNzOiAnaXMtaW52YWxpZC1pbnB1dCcsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIHNlbGVjdG9yIHRvIHVzZSB0byB0YXJnZXQgRm9ybSBFcnJvcnMgZm9yIHNob3cvaGlkZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJy5mb3JtLWVycm9yJ1xyXG4gICAqL1xyXG4gIGZvcm1FcnJvclNlbGVjdG9yOiAnLmZvcm0tZXJyb3InLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyBhZGRlZCB0byBGb3JtIEVycm9ycyBvbiBmYWlsZWQgdmFsaWRhdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2lzLXZpc2libGUnXHJcbiAgICovXHJcbiAgZm9ybUVycm9yQ2xhc3M6ICdpcy12aXNpYmxlJyxcclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IHRvIHRydWUgdG8gdmFsaWRhdGUgdGV4dCBpbnB1dHMgb24gYW55IHZhbHVlIGNoYW5nZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBsaXZlVmFsaWRhdGU6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBTZXQgdG8gdHJ1ZSB0byB2YWxpZGF0ZSBpbnB1dHMgb24gYmx1ci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICB2YWxpZGF0ZU9uQmx1cjogZmFsc2UsXHJcblxyXG4gIHBhdHRlcm5zOiB7XHJcbiAgICBhbHBoYSA6IC9eW2EtekEtWl0rJC8sXHJcbiAgICBhbHBoYV9udW1lcmljIDogL15bYS16QS1aMC05XSskLyxcclxuICAgIGludGVnZXIgOiAvXlstK10/XFxkKyQvLFxyXG4gICAgbnVtYmVyIDogL15bLStdP1xcZCooPzpbXFwuXFwsXVxcZCspPyQvLFxyXG5cclxuICAgIC8vIGFtZXgsIHZpc2EsIGRpbmVyc1xyXG4gICAgY2FyZCA6IC9eKD86NFswLTldezEyfSg/OlswLTldezN9KT98NVsxLTVdWzAtOV17MTR9fDYoPzowMTF8NVswLTldWzAtOV0pWzAtOV17MTJ9fDNbNDddWzAtOV17MTN9fDMoPzowWzAtNV18WzY4XVswLTldKVswLTldezExfXwoPzoyMTMxfDE4MDB8MzVcXGR7M30pXFxkezExfSkkLyxcclxuICAgIGN2diA6IC9eKFswLTldKXszLDR9JC8sXHJcblxyXG4gICAgLy8gaHR0cDovL3d3dy53aGF0d2cub3JnL3NwZWNzL3dlYi1hcHBzL2N1cnJlbnQtd29yay9tdWx0aXBhZ2Uvc3RhdGVzLW9mLXRoZS10eXBlLWF0dHJpYnV0ZS5odG1sI3ZhbGlkLWUtbWFpbC1hZGRyZXNzXHJcbiAgICBlbWFpbCA6IC9eW2EtekEtWjAtOS4hIyQlJicqK1xcLz0/Xl9ge3x9fi1dK0BbYS16QS1aMC05XSg/OlthLXpBLVowLTktXXswLDYxfVthLXpBLVowLTldKT8oPzpcXC5bYS16QS1aMC05XSg/OlthLXpBLVowLTktXXswLDYxfVthLXpBLVowLTldKT8pKyQvLFxyXG5cclxuICAgIHVybCA6IC9eKGh0dHBzP3xmdHB8ZmlsZXxzc2gpOlxcL1xcLygoKChbYS16QS1aXXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoJVtcXGRhLWZdezJ9KXxbIVxcJCYnXFwoXFwpXFwqXFwrLDs9XXw6KSpAKT8oKChcXGR8WzEtOV1cXGR8MVxcZFxcZHwyWzAtNF1cXGR8MjVbMC01XSlcXC4oXFxkfFsxLTldXFxkfDFcXGRcXGR8MlswLTRdXFxkfDI1WzAtNV0pXFwuKFxcZHxbMS05XVxcZHwxXFxkXFxkfDJbMC00XVxcZHwyNVswLTVdKVxcLihcXGR8WzEtOV1cXGR8MVxcZFxcZHwyWzAtNF1cXGR8MjVbMC01XSkpfCgoKFthLXpBLVpdfFxcZHxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KChbYS16QS1aXXxcXGR8W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKFthLXpBLVpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKihbYS16QS1aXXxcXGR8W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKSlcXC4pKygoW2EtekEtWl18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCgoW2EtekEtWl18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKFthLXpBLVpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKihbYS16QS1aXXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkpKVxcLj8pKDpcXGQqKT8pKFxcLygoKFthLXpBLVpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCglW1xcZGEtZl17Mn0pfFshXFwkJidcXChcXClcXCpcXCssOz1dfDp8QCkrKFxcLygoW2EtekEtWl18XFxkfC18XFwufF98fnxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KCVbXFxkYS1mXXsyfSl8WyFcXCQmJ1xcKFxcKVxcKlxcKyw7PV18OnxAKSopKik/KT8oXFw/KCgoW2EtekEtWl18XFxkfC18XFwufF98fnxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KCVbXFxkYS1mXXsyfSl8WyFcXCQmJ1xcKFxcKVxcKlxcKyw7PV18OnxAKXxbXFx1RTAwMC1cXHVGOEZGXXxcXC98XFw/KSopPyhcXCMoKChbYS16QS1aXXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoJVtcXGRhLWZdezJ9KXxbIVxcJCYnXFwoXFwpXFwqXFwrLDs9XXw6fEApfFxcL3xcXD8pKik/JC8sXHJcbiAgICAvLyBhYmMuZGVcclxuICAgIGRvbWFpbiA6IC9eKFthLXpBLVowLTldKFthLXpBLVowLTlcXC1dezAsNjF9W2EtekEtWjAtOV0pP1xcLikrW2EtekEtWl17Miw4fSQvLFxyXG5cclxuICAgIGRhdGV0aW1lIDogL14oWzAtMl1bMC05XXszfSlcXC0oWzAtMV1bMC05XSlcXC0oWzAtM11bMC05XSlUKFswLTVdWzAtOV0pXFw6KFswLTVdWzAtOV0pXFw6KFswLTVdWzAtOV0pKFp8KFtcXC1cXCtdKFswLTFdWzAtOV0pXFw6MDApKSQvLFxyXG4gICAgLy8gWVlZWS1NTS1ERFxyXG4gICAgZGF0ZSA6IC8oPzoxOXwyMClbMC05XXsyfS0oPzooPzowWzEtOV18MVswLTJdKS0oPzowWzEtOV18MVswLTldfDJbMC05XSl8KD86KD8hMDIpKD86MFsxLTldfDFbMC0yXSktKD86MzApKXwoPzooPzowWzEzNTc4XXwxWzAyXSktMzEpKSQvLFxyXG4gICAgLy8gSEg6TU06U1NcclxuICAgIHRpbWUgOiAvXigwWzAtOV18MVswLTldfDJbMC0zXSkoOlswLTVdWzAtOV0pezJ9JC8sXHJcbiAgICBkYXRlSVNPIDogL15cXGR7NH1bXFwvXFwtXVxcZHsxLDJ9W1xcL1xcLV1cXGR7MSwyfSQvLFxyXG4gICAgLy8gTU0vREQvWVlZWVxyXG4gICAgbW9udGhfZGF5X3llYXIgOiAvXigwWzEtOV18MVswMTJdKVstIFxcLy5dKDBbMS05XXxbMTJdWzAtOV18M1swMV0pWy0gXFwvLl1cXGR7NH0kLyxcclxuICAgIC8vIEREL01NL1lZWVlcclxuICAgIGRheV9tb250aF95ZWFyIDogL14oMFsxLTldfFsxMl1bMC05XXwzWzAxXSlbLSBcXC8uXSgwWzEtOV18MVswMTJdKVstIFxcLy5dXFxkezR9JC8sXHJcblxyXG4gICAgLy8gI0ZGRiBvciAjRkZGRkZGXHJcbiAgICBjb2xvciA6IC9eIz8oW2EtZkEtRjAtOV17Nn18W2EtZkEtRjAtOV17M30pJC9cclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBPcHRpb25hbCB2YWxpZGF0aW9uIGZ1bmN0aW9ucyB0byBiZSB1c2VkLiBgZXF1YWxUb2AgYmVpbmcgdGhlIG9ubHkgZGVmYXVsdCBpbmNsdWRlZCBmdW5jdGlvbi5cclxuICAgKiBGdW5jdGlvbnMgc2hvdWxkIHJldHVybiBvbmx5IGEgYm9vbGVhbiBpZiB0aGUgaW5wdXQgaXMgdmFsaWQgb3Igbm90LiBGdW5jdGlvbnMgYXJlIGdpdmVuIHRoZSBmb2xsb3dpbmcgYXJndW1lbnRzOlxyXG4gICAqIGVsIDogVGhlIGpRdWVyeSBlbGVtZW50IHRvIHZhbGlkYXRlLlxyXG4gICAqIHJlcXVpcmVkIDogQm9vbGVhbiB2YWx1ZSBvZiB0aGUgcmVxdWlyZWQgYXR0cmlidXRlIGJlIHByZXNlbnQgb3Igbm90LlxyXG4gICAqIHBhcmVudCA6IFRoZSBkaXJlY3QgcGFyZW50IG9mIHRoZSBpbnB1dC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICovXHJcbiAgdmFsaWRhdG9yczoge1xyXG4gICAgZXF1YWxUbzogZnVuY3Rpb24gKGVsLCByZXF1aXJlZCwgcGFyZW50KSB7XHJcbiAgICAgIHJldHVybiAkKGAjJHtlbC5hdHRyKCdkYXRhLWVxdWFsdG8nKX1gKS52YWwoKSA9PT0gZWwudmFsKCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihBYmlkZSwgJ0FiaWRlJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogQWNjb3JkaW9uIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmFjY29yZGlvblxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXHJcbiAqL1xyXG5cclxuY2xhc3MgQWNjb3JkaW9uIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGFuIGFjY29yZGlvbi5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uI2luaXRcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGFuIGFjY29yZGlvbi5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIGEgcGxhaW4gb2JqZWN0IHdpdGggc2V0dGluZ3MgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHQgb3B0aW9ucy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBY2NvcmRpb24uZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnQWNjb3JkaW9uJyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdBY2NvcmRpb24nLCB7XHJcbiAgICAgICdFTlRFUic6ICd0b2dnbGUnLFxyXG4gICAgICAnU1BBQ0UnOiAndG9nZ2xlJyxcclxuICAgICAgJ0FSUk9XX0RPV04nOiAnbmV4dCcsXHJcbiAgICAgICdBUlJPV19VUCc6ICdwcmV2aW91cydcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGFjY29yZGlvbiBieSBhbmltYXRpbmcgdGhlIHByZXNldCBhY3RpdmUgcGFuZShzKS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdyb2xlJywgJ3RhYmxpc3QnKTtcclxuICAgIHRoaXMuJHRhYnMgPSB0aGlzLiRlbGVtZW50LmNoaWxkcmVuKCdbZGF0YS1hY2NvcmRpb24taXRlbV0nKTtcclxuXHJcbiAgICB0aGlzLiR0YWJzLmVhY2goZnVuY3Rpb24oaWR4LCBlbCkge1xyXG4gICAgICB2YXIgJGVsID0gJChlbCksXHJcbiAgICAgICAgICAkY29udGVudCA9ICRlbC5jaGlsZHJlbignW2RhdGEtdGFiLWNvbnRlbnRdJyksXHJcbiAgICAgICAgICBpZCA9ICRjb250ZW50WzBdLmlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ2FjY29yZGlvbicpLFxyXG4gICAgICAgICAgbGlua0lkID0gZWwuaWQgfHwgYCR7aWR9LWxhYmVsYDtcclxuXHJcbiAgICAgICRlbC5maW5kKCdhOmZpcnN0JykuYXR0cih7XHJcbiAgICAgICAgJ2FyaWEtY29udHJvbHMnOiBpZCxcclxuICAgICAgICAncm9sZSc6ICd0YWInLFxyXG4gICAgICAgICdpZCc6IGxpbmtJZCxcclxuICAgICAgICAnYXJpYS1leHBhbmRlZCc6IGZhbHNlLFxyXG4gICAgICAgICdhcmlhLXNlbGVjdGVkJzogZmFsc2VcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAkY29udGVudC5hdHRyKHsncm9sZSc6ICd0YWJwYW5lbCcsICdhcmlhLWxhYmVsbGVkYnknOiBsaW5rSWQsICdhcmlhLWhpZGRlbic6IHRydWUsICdpZCc6IGlkfSk7XHJcbiAgICB9KTtcclxuICAgIHZhciAkaW5pdEFjdGl2ZSA9IHRoaXMuJGVsZW1lbnQuZmluZCgnLmlzLWFjdGl2ZScpLmNoaWxkcmVuKCdbZGF0YS10YWItY29udGVudF0nKTtcclxuICAgIGlmKCRpbml0QWN0aXZlLmxlbmd0aCl7XHJcbiAgICAgIHRoaXMuZG93bigkaW5pdEFjdGl2ZSwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgZm9yIGl0ZW1zIHdpdGhpbiB0aGUgYWNjb3JkaW9uLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kdGFicy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICB2YXIgJGVsZW0gPSAkKHRoaXMpO1xyXG4gICAgICB2YXIgJHRhYkNvbnRlbnQgPSAkZWxlbS5jaGlsZHJlbignW2RhdGEtdGFiLWNvbnRlbnRdJyk7XHJcbiAgICAgIGlmICgkdGFiQ29udGVudC5sZW5ndGgpIHtcclxuICAgICAgICAkZWxlbS5jaGlsZHJlbignYScpLm9mZignY2xpY2suemYuYWNjb3JkaW9uIGtleWRvd24uemYuYWNjb3JkaW9uJylcclxuICAgICAgICAgICAgICAgLm9uKCdjbGljay56Zi5hY2NvcmRpb24nLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBfdGhpcy50b2dnbGUoJHRhYkNvbnRlbnQpO1xyXG4gICAgICAgIH0pLm9uKCdrZXlkb3duLnpmLmFjY29yZGlvbicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ0FjY29yZGlvbicsIHtcclxuICAgICAgICAgICAgdG9nZ2xlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICBfdGhpcy50b2dnbGUoJHRhYkNvbnRlbnQpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBuZXh0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICB2YXIgJGEgPSAkZWxlbS5uZXh0KCkuZmluZCgnYScpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgaWYgKCFfdGhpcy5vcHRpb25zLm11bHRpRXhwYW5kKSB7XHJcbiAgICAgICAgICAgICAgICAkYS50cmlnZ2VyKCdjbGljay56Zi5hY2NvcmRpb24nKVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcHJldmlvdXM6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgIHZhciAkYSA9ICRlbGVtLnByZXYoKS5maW5kKCdhJykuZm9jdXMoKTtcclxuICAgICAgICAgICAgICBpZiAoIV90aGlzLm9wdGlvbnMubXVsdGlFeHBhbmQpIHtcclxuICAgICAgICAgICAgICAgICRhLnRyaWdnZXIoJ2NsaWNrLnpmLmFjY29yZGlvbicpXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyB0aGUgc2VsZWN0ZWQgY29udGVudCBwYW5lJ3Mgb3Blbi9jbG9zZSBzdGF0ZS5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIGpRdWVyeSBvYmplY3Qgb2YgdGhlIHBhbmUgdG8gdG9nZ2xlIChgLmFjY29yZGlvbi1jb250ZW50YCkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgdG9nZ2xlKCR0YXJnZXQpIHtcclxuICAgIGlmKCR0YXJnZXQucGFyZW50KCkuaGFzQ2xhc3MoJ2lzLWFjdGl2ZScpKSB7XHJcbiAgICAgIHRoaXMudXAoJHRhcmdldCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmRvd24oJHRhcmdldCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyB0aGUgYWNjb3JkaW9uIHRhYiBkZWZpbmVkIGJ5IGAkdGFyZ2V0YC5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIEFjY29yZGlvbiBwYW5lIHRvIG9wZW4gKGAuYWNjb3JkaW9uLWNvbnRlbnRgKS5cclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGZpcnN0VGltZSAtIGZsYWcgdG8gZGV0ZXJtaW5lIGlmIHJlZmxvdyBzaG91bGQgaGFwcGVuLlxyXG4gICAqIEBmaXJlcyBBY2NvcmRpb24jZG93blxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRvd24oJHRhcmdldCwgZmlyc3RUaW1lKSB7XHJcbiAgICAkdGFyZ2V0XHJcbiAgICAgIC5hdHRyKCdhcmlhLWhpZGRlbicsIGZhbHNlKVxyXG4gICAgICAucGFyZW50KCdbZGF0YS10YWItY29udGVudF0nKVxyXG4gICAgICAuYWRkQmFjaygpXHJcbiAgICAgIC5wYXJlbnQoKS5hZGRDbGFzcygnaXMtYWN0aXZlJyk7XHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMubXVsdGlFeHBhbmQgJiYgIWZpcnN0VGltZSkge1xyXG4gICAgICB2YXIgJGN1cnJlbnRBY3RpdmUgPSB0aGlzLiRlbGVtZW50LmNoaWxkcmVuKCcuaXMtYWN0aXZlJykuY2hpbGRyZW4oJ1tkYXRhLXRhYi1jb250ZW50XScpO1xyXG4gICAgICBpZiAoJGN1cnJlbnRBY3RpdmUubGVuZ3RoKSB7XHJcbiAgICAgICAgdGhpcy51cCgkY3VycmVudEFjdGl2ZS5ub3QoJHRhcmdldCkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgJHRhcmdldC5zbGlkZURvd24odGhpcy5vcHRpb25zLnNsaWRlU3BlZWQsICgpID0+IHtcclxuICAgICAgLyoqXHJcbiAgICAgICAqIEZpcmVzIHdoZW4gdGhlIHRhYiBpcyBkb25lIG9wZW5pbmcuXHJcbiAgICAgICAqIEBldmVudCBBY2NvcmRpb24jZG93blxyXG4gICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdkb3duLnpmLmFjY29yZGlvbicsIFskdGFyZ2V0XSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAkKGAjJHskdGFyZ2V0LmF0dHIoJ2FyaWEtbGFiZWxsZWRieScpfWApLmF0dHIoe1xyXG4gICAgICAnYXJpYS1leHBhbmRlZCc6IHRydWUsXHJcbiAgICAgICdhcmlhLXNlbGVjdGVkJzogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9zZXMgdGhlIHRhYiBkZWZpbmVkIGJ5IGAkdGFyZ2V0YC5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIEFjY29yZGlvbiB0YWIgdG8gY2xvc2UgKGAuYWNjb3JkaW9uLWNvbnRlbnRgKS5cclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uI3VwXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgdXAoJHRhcmdldCkge1xyXG4gICAgdmFyICRhdW50cyA9ICR0YXJnZXQucGFyZW50KCkuc2libGluZ3MoKSxcclxuICAgICAgICBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgaWYoKCF0aGlzLm9wdGlvbnMuYWxsb3dBbGxDbG9zZWQgJiYgISRhdW50cy5oYXNDbGFzcygnaXMtYWN0aXZlJykpIHx8ICEkdGFyZ2V0LnBhcmVudCgpLmhhc0NsYXNzKCdpcy1hY3RpdmUnKSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRm91bmRhdGlvbi5Nb3ZlKHRoaXMub3B0aW9ucy5zbGlkZVNwZWVkLCAkdGFyZ2V0LCBmdW5jdGlvbigpe1xyXG4gICAgICAkdGFyZ2V0LnNsaWRlVXAoX3RoaXMub3B0aW9ucy5zbGlkZVNwZWVkLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgdGFiIGlzIGRvbmUgY29sbGFwc2luZyB1cC5cclxuICAgICAgICAgKiBAZXZlbnQgQWNjb3JkaW9uI3VwXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgX3RoaXMuJGVsZW1lbnQudHJpZ2dlcigndXAuemYuYWNjb3JkaW9uJywgWyR0YXJnZXRdKTtcclxuICAgICAgfSk7XHJcbiAgICAvLyB9KTtcclxuXHJcbiAgICAkdGFyZ2V0LmF0dHIoJ2FyaWEtaGlkZGVuJywgdHJ1ZSlcclxuICAgICAgICAgICAucGFyZW50KCkucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZScpO1xyXG5cclxuICAgICQoYCMkeyR0YXJnZXQuYXR0cignYXJpYS1sYWJlbGxlZGJ5Jyl9YCkuYXR0cih7XHJcbiAgICAgJ2FyaWEtZXhwYW5kZWQnOiBmYWxzZSxcclxuICAgICAnYXJpYS1zZWxlY3RlZCc6IGZhbHNlXHJcbiAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgYW4gYWNjb3JkaW9uLlxyXG4gICAqIEBmaXJlcyBBY2NvcmRpb24jZGVzdHJveWVkXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtdGFiLWNvbnRlbnRdJykuc3RvcCh0cnVlKS5zbGlkZVVwKDApLmNzcygnZGlzcGxheScsICcnKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnYScpLm9mZignLnpmLmFjY29yZGlvbicpO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbkFjY29yZGlvbi5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBBbW91bnQgb2YgdGltZSB0byBhbmltYXRlIHRoZSBvcGVuaW5nIG9mIGFuIGFjY29yZGlvbiBwYW5lLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAyNTBcclxuICAgKi9cclxuICBzbGlkZVNwZWVkOiAyNTAsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIGFjY29yZGlvbiB0byBoYXZlIG11bHRpcGxlIG9wZW4gcGFuZXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgbXVsdGlFeHBhbmQ6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBhY2NvcmRpb24gdG8gY2xvc2UgYWxsIHBhbmVzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGFsbG93QWxsQ2xvc2VkOiBmYWxzZVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oQWNjb3JkaW9uLCAnQWNjb3JkaW9uJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogQWNjb3JkaW9uTWVudSBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5hY2NvcmRpb25NZW51XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5uZXN0XHJcbiAqL1xyXG5cclxuY2xhc3MgQWNjb3JkaW9uTWVudSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhbiBhY2NvcmRpb24gbWVudS5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uTWVudSNpbml0XHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhbiBhY2NvcmRpb24gbWVudS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgQWNjb3JkaW9uTWVudS5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIEZvdW5kYXRpb24uTmVzdC5GZWF0aGVyKHRoaXMuJGVsZW1lbnQsICdhY2NvcmRpb24nKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnQWNjb3JkaW9uTWVudScpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignQWNjb3JkaW9uTWVudScsIHtcclxuICAgICAgJ0VOVEVSJzogJ3RvZ2dsZScsXHJcbiAgICAgICdTUEFDRSc6ICd0b2dnbGUnLFxyXG4gICAgICAnQVJST1dfUklHSFQnOiAnb3BlbicsXHJcbiAgICAgICdBUlJPV19VUCc6ICd1cCcsXHJcbiAgICAgICdBUlJPV19ET1dOJzogJ2Rvd24nLFxyXG4gICAgICAnQVJST1dfTEVGVCc6ICdjbG9zZScsXHJcbiAgICAgICdFU0NBUEUnOiAnY2xvc2VBbGwnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGFjY29yZGlvbiBtZW51IGJ5IGhpZGluZyBhbGwgbmVzdGVkIG1lbnVzLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXN1Ym1lbnVdJykubm90KCcuaXMtYWN0aXZlJykuc2xpZGVVcCgwKTsvLy5maW5kKCdhJykuY3NzKCdwYWRkaW5nLWxlZnQnLCAnMXJlbScpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKHtcclxuICAgICAgJ3JvbGUnOiAnbWVudScsXHJcbiAgICAgICdhcmlhLW11bHRpc2VsZWN0YWJsZSc6IHRoaXMub3B0aW9ucy5tdWx0aU9wZW5cclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuJG1lbnVMaW5rcyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnLmlzLWFjY29yZGlvbi1zdWJtZW51LXBhcmVudCcpO1xyXG4gICAgdGhpcy4kbWVudUxpbmtzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgdmFyIGxpbmtJZCA9IHRoaXMuaWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnYWNjLW1lbnUtbGluaycpLFxyXG4gICAgICAgICAgJGVsZW0gPSAkKHRoaXMpLFxyXG4gICAgICAgICAgJHN1YiA9ICRlbGVtLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpLFxyXG4gICAgICAgICAgc3ViSWQgPSAkc3ViWzBdLmlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ2FjYy1tZW51JyksXHJcbiAgICAgICAgICBpc0FjdGl2ZSA9ICRzdWIuaGFzQ2xhc3MoJ2lzLWFjdGl2ZScpO1xyXG4gICAgICAkZWxlbS5hdHRyKHtcclxuICAgICAgICAnYXJpYS1jb250cm9scyc6IHN1YklkLFxyXG4gICAgICAgICdhcmlhLWV4cGFuZGVkJzogaXNBY3RpdmUsXHJcbiAgICAgICAgJ3JvbGUnOiAnbWVudWl0ZW0nLFxyXG4gICAgICAgICdpZCc6IGxpbmtJZFxyXG4gICAgICB9KTtcclxuICAgICAgJHN1Yi5hdHRyKHtcclxuICAgICAgICAnYXJpYS1sYWJlbGxlZGJ5JzogbGlua0lkLFxyXG4gICAgICAgICdhcmlhLWhpZGRlbic6ICFpc0FjdGl2ZSxcclxuICAgICAgICAncm9sZSc6ICdtZW51JyxcclxuICAgICAgICAnaWQnOiBzdWJJZFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gICAgdmFyIGluaXRQYW5lcyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnLmlzLWFjdGl2ZScpO1xyXG4gICAgaWYoaW5pdFBhbmVzLmxlbmd0aCl7XHJcbiAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgIGluaXRQYW5lcy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgX3RoaXMuZG93bigkKHRoaXMpKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgZm9yIGl0ZW1zIHdpdGhpbiB0aGUgbWVudS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnbGknKS5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICB2YXIgJHN1Ym1lbnUgPSAkKHRoaXMpLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpO1xyXG5cclxuICAgICAgaWYgKCRzdWJtZW51Lmxlbmd0aCkge1xyXG4gICAgICAgICQodGhpcykuY2hpbGRyZW4oJ2EnKS5vZmYoJ2NsaWNrLnpmLmFjY29yZGlvbk1lbnUnKS5vbignY2xpY2suemYuYWNjb3JkaW9uTWVudScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcbiAgICAgICAgICBfdGhpcy50b2dnbGUoJHN1Ym1lbnUpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KS5vbigna2V5ZG93bi56Zi5hY2NvcmRpb25tZW51JywgZnVuY3Rpb24oZSl7XHJcbiAgICAgIHZhciAkZWxlbWVudCA9ICQodGhpcyksXHJcbiAgICAgICAgICAkZWxlbWVudHMgPSAkZWxlbWVudC5wYXJlbnQoJ3VsJykuY2hpbGRyZW4oJ2xpJyksXHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQsXHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQsXHJcbiAgICAgICAgICAkdGFyZ2V0ID0gJGVsZW1lbnQuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJyk7XHJcblxyXG4gICAgICAkZWxlbWVudHMuZWFjaChmdW5jdGlvbihpKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykuaXMoJGVsZW1lbnQpKSB7XHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQgPSAkZWxlbWVudHMuZXEoTWF0aC5tYXgoMCwgaS0xKSkuZmluZCgnYScpLmZpcnN0KCk7XHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQgPSAkZWxlbWVudHMuZXEoTWF0aC5taW4oaSsxLCAkZWxlbWVudHMubGVuZ3RoLTEpKS5maW5kKCdhJykuZmlyc3QoKTtcclxuXHJcbiAgICAgICAgICBpZiAoJCh0aGlzKS5jaGlsZHJlbignW2RhdGEtc3VibWVudV06dmlzaWJsZScpLmxlbmd0aCkgeyAvLyBoYXMgb3BlbiBzdWIgbWVudVxyXG4gICAgICAgICAgICAkbmV4dEVsZW1lbnQgPSAkZWxlbWVudC5maW5kKCdsaTpmaXJzdC1jaGlsZCcpLmZpbmQoJ2EnKS5maXJzdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKCQodGhpcykuaXMoJzpmaXJzdC1jaGlsZCcpKSB7IC8vIGlzIGZpcnN0IGVsZW1lbnQgb2Ygc3ViIG1lbnVcclxuICAgICAgICAgICAgJHByZXZFbGVtZW50ID0gJGVsZW1lbnQucGFyZW50cygnbGknKS5maXJzdCgpLmZpbmQoJ2EnKS5maXJzdCgpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmICgkcHJldkVsZW1lbnQucGFyZW50cygnbGknKS5maXJzdCgpLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XTp2aXNpYmxlJykubGVuZ3RoKSB7IC8vIGlmIHByZXZpb3VzIGVsZW1lbnQgaGFzIG9wZW4gc3ViIG1lbnVcclxuICAgICAgICAgICAgJHByZXZFbGVtZW50ID0gJHByZXZFbGVtZW50LnBhcmVudHMoJ2xpJykuZmluZCgnbGk6bGFzdC1jaGlsZCcpLmZpbmQoJ2EnKS5maXJzdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKCQodGhpcykuaXMoJzpsYXN0LWNoaWxkJykpIHsgLy8gaXMgbGFzdCBlbGVtZW50IG9mIHN1YiBtZW51XHJcbiAgICAgICAgICAgICRuZXh0RWxlbWVudCA9ICRlbGVtZW50LnBhcmVudHMoJ2xpJykuZmlyc3QoKS5uZXh0KCdsaScpLmZpbmQoJ2EnKS5maXJzdCgpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ0FjY29yZGlvbk1lbnUnLCB7XHJcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoJHRhcmdldC5pcygnOmhpZGRlbicpKSB7XHJcbiAgICAgICAgICAgIF90aGlzLmRvd24oJHRhcmdldCk7XHJcbiAgICAgICAgICAgICR0YXJnZXQuZmluZCgnbGknKS5maXJzdCgpLmZpbmQoJ2EnKS5maXJzdCgpLmZvY3VzKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoJHRhcmdldC5sZW5ndGggJiYgISR0YXJnZXQuaXMoJzpoaWRkZW4nKSkgeyAvLyBjbG9zZSBhY3RpdmUgc3ViIG9mIHRoaXMgaXRlbVxyXG4gICAgICAgICAgICBfdGhpcy51cCgkdGFyZ2V0KTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoJGVsZW1lbnQucGFyZW50KCdbZGF0YS1zdWJtZW51XScpLmxlbmd0aCkgeyAvLyBjbG9zZSBjdXJyZW50bHkgb3BlbiBzdWJcclxuICAgICAgICAgICAgX3RoaXMudXAoJGVsZW1lbnQucGFyZW50KCdbZGF0YS1zdWJtZW51XScpKTtcclxuICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50cygnbGknKS5maXJzdCgpLmZpbmQoJ2EnKS5maXJzdCgpLmZvY3VzKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICB1cDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQuZm9jdXMoKTtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZG93bjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQuZm9jdXMoKTtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdG9nZ2xlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICgkZWxlbWVudC5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgX3RoaXMudG9nZ2xlKCRlbGVtZW50LmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGNsb3NlQWxsOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIF90aGlzLmhpZGVBbGwoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKHByZXZlbnREZWZhdWx0KSB7XHJcbiAgICAgICAgICBpZiAocHJldmVudERlZmF1bHQpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7Ly8uYXR0cigndGFiaW5kZXgnLCAwKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb3NlcyBhbGwgcGFuZXMgb2YgdGhlIG1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgaGlkZUFsbCgpIHtcclxuICAgIHRoaXMudXAodGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1zdWJtZW51XScpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIGFsbCBwYW5lcyBvZiB0aGUgbWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBzaG93QWxsKCkge1xyXG4gICAgdGhpcy5kb3duKHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtc3VibWVudV0nKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHRoZSBvcGVuL2Nsb3NlIHN0YXRlIG9mIGEgc3VibWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIHRoZSBzdWJtZW51IHRvIHRvZ2dsZVxyXG4gICAqL1xyXG4gIHRvZ2dsZSgkdGFyZ2V0KXtcclxuICAgIGlmKCEkdGFyZ2V0LmlzKCc6YW5pbWF0ZWQnKSkge1xyXG4gICAgICBpZiAoISR0YXJnZXQuaXMoJzpoaWRkZW4nKSkge1xyXG4gICAgICAgIHRoaXMudXAoJHRhcmdldCk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgdGhpcy5kb3duKCR0YXJnZXQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyB0aGUgc3ViLW1lbnUgZGVmaW5lZCBieSBgJHRhcmdldGAuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBTdWItbWVudSB0byBvcGVuLlxyXG4gICAqIEBmaXJlcyBBY2NvcmRpb25NZW51I2Rvd25cclxuICAgKi9cclxuICBkb3duKCR0YXJnZXQpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgaWYoIXRoaXMub3B0aW9ucy5tdWx0aU9wZW4pIHtcclxuICAgICAgdGhpcy51cCh0aGlzLiRlbGVtZW50LmZpbmQoJy5pcy1hY3RpdmUnKS5ub3QoJHRhcmdldC5wYXJlbnRzVW50aWwodGhpcy4kZWxlbWVudCkuYWRkKCR0YXJnZXQpKSk7XHJcbiAgICB9XHJcblxyXG4gICAgJHRhcmdldC5hZGRDbGFzcygnaXMtYWN0aXZlJykuYXR0cih7J2FyaWEtaGlkZGVuJzogZmFsc2V9KVxyXG4gICAgICAucGFyZW50KCcuaXMtYWNjb3JkaW9uLXN1Ym1lbnUtcGFyZW50JykuYXR0cih7J2FyaWEtZXhwYW5kZWQnOiB0cnVlfSk7XHJcblxyXG4gICAgICAvL0ZvdW5kYXRpb24uTW92ZSh0aGlzLm9wdGlvbnMuc2xpZGVTcGVlZCwgJHRhcmdldCwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgJHRhcmdldC5zbGlkZURvd24oX3RoaXMub3B0aW9ucy5zbGlkZVNwZWVkLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAvKipcclxuICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIG1lbnUgaXMgZG9uZSBvcGVuaW5nLlxyXG4gICAgICAgICAgICogQGV2ZW50IEFjY29yZGlvbk1lbnUjZG93blxyXG4gICAgICAgICAgICovXHJcbiAgICAgICAgICBfdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdkb3duLnpmLmFjY29yZGlvbk1lbnUnLCBbJHRhcmdldF0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAvL30pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvc2VzIHRoZSBzdWItbWVudSBkZWZpbmVkIGJ5IGAkdGFyZ2V0YC4gQWxsIHN1Yi1tZW51cyBpbnNpZGUgdGhlIHRhcmdldCB3aWxsIGJlIGNsb3NlZCBhcyB3ZWxsLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gU3ViLW1lbnUgdG8gY2xvc2UuXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbk1lbnUjdXBcclxuICAgKi9cclxuICB1cCgkdGFyZ2V0KSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgLy9Gb3VuZGF0aW9uLk1vdmUodGhpcy5vcHRpb25zLnNsaWRlU3BlZWQsICR0YXJnZXQsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICR0YXJnZXQuc2xpZGVVcChfdGhpcy5vcHRpb25zLnNsaWRlU3BlZWQsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBtZW51IGlzIGRvbmUgY29sbGFwc2luZyB1cC5cclxuICAgICAgICAgKiBAZXZlbnQgQWNjb3JkaW9uTWVudSN1cFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIF90aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3VwLnpmLmFjY29yZGlvbk1lbnUnLCBbJHRhcmdldF0pO1xyXG4gICAgICB9KTtcclxuICAgIC8vfSk7XHJcblxyXG4gICAgdmFyICRtZW51cyA9ICR0YXJnZXQuZmluZCgnW2RhdGEtc3VibWVudV0nKS5zbGlkZVVwKDApLmFkZEJhY2soKS5hdHRyKCdhcmlhLWhpZGRlbicsIHRydWUpO1xyXG5cclxuICAgICRtZW51cy5wYXJlbnQoJy5pcy1hY2NvcmRpb24tc3VibWVudS1wYXJlbnQnKS5hdHRyKCdhcmlhLWV4cGFuZGVkJywgZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgYWNjb3JkaW9uIG1lbnUuXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbk1lbnUjZGVzdHJveWVkXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtc3VibWVudV0nKS5zbGlkZURvd24oMCkuY3NzKCdkaXNwbGF5JywgJycpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdhJykub2ZmKCdjbGljay56Zi5hY2NvcmRpb25NZW51Jyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5OZXN0LkJ1cm4odGhpcy4kZWxlbWVudCwgJ2FjY29yZGlvbicpO1xyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuQWNjb3JkaW9uTWVudS5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBBbW91bnQgb2YgdGltZSB0byBhbmltYXRlIHRoZSBvcGVuaW5nIG9mIGEgc3VibWVudSBpbiBtcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMjUwXHJcbiAgICovXHJcbiAgc2xpZGVTcGVlZDogMjUwLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBtZW51IHRvIGhhdmUgbXVsdGlwbGUgb3BlbiBwYW5lcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIG11bHRpT3BlbjogdHJ1ZVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oQWNjb3JkaW9uTWVudSwgJ0FjY29yZGlvbk1lbnUnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBEcmlsbGRvd24gbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uZHJpbGxkb3duXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5uZXN0XHJcbiAqL1xyXG5cclxuY2xhc3MgRHJpbGxkb3duIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGEgZHJpbGxkb3duIG1lbnUuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhbiBhY2NvcmRpb24gbWVudS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgRHJpbGxkb3duLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5OZXN0LkZlYXRoZXIodGhpcy4kZWxlbWVudCwgJ2RyaWxsZG93bicpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdEcmlsbGRvd24nKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ0RyaWxsZG93bicsIHtcclxuICAgICAgJ0VOVEVSJzogJ29wZW4nLFxyXG4gICAgICAnU1BBQ0UnOiAnb3BlbicsXHJcbiAgICAgICdBUlJPV19SSUdIVCc6ICduZXh0JyxcclxuICAgICAgJ0FSUk9XX1VQJzogJ3VwJyxcclxuICAgICAgJ0FSUk9XX0RPV04nOiAnZG93bicsXHJcbiAgICAgICdBUlJPV19MRUZUJzogJ3ByZXZpb3VzJyxcclxuICAgICAgJ0VTQ0FQRSc6ICdjbG9zZScsXHJcbiAgICAgICdUQUInOiAnZG93bicsXHJcbiAgICAgICdTSElGVF9UQUInOiAndXAnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBkcmlsbGRvd24gYnkgY3JlYXRpbmcgalF1ZXJ5IGNvbGxlY3Rpb25zIG9mIGVsZW1lbnRzXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHRoaXMuJHN1Ym1lbnVBbmNob3JzID0gdGhpcy4kZWxlbWVudC5maW5kKCdsaS5pcy1kcmlsbGRvd24tc3VibWVudS1wYXJlbnQnKS5jaGlsZHJlbignYScpO1xyXG4gICAgdGhpcy4kc3VibWVudXMgPSB0aGlzLiRzdWJtZW51QW5jaG9ycy5wYXJlbnQoJ2xpJykuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJyk7XHJcbiAgICB0aGlzLiRtZW51SXRlbXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2xpJykubm90KCcuanMtZHJpbGxkb3duLWJhY2snKS5hdHRyKCdyb2xlJywgJ21lbnVpdGVtJykuZmluZCgnYScpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdkYXRhLW11dGF0ZScsICh0aGlzLiRlbGVtZW50LmF0dHIoJ2RhdGEtZHJpbGxkb3duJykgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnZHJpbGxkb3duJykpKTtcclxuXHJcbiAgICB0aGlzLl9wcmVwYXJlTWVudSgpO1xyXG4gICAgdGhpcy5fcmVnaXN0ZXJFdmVudHMoKTtcclxuXHJcbiAgICB0aGlzLl9rZXlib2FyZEV2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogcHJlcGFyZXMgZHJpbGxkb3duIG1lbnUgYnkgc2V0dGluZyBhdHRyaWJ1dGVzIHRvIGxpbmtzIGFuZCBlbGVtZW50c1xyXG4gICAqIHNldHMgYSBtaW4gaGVpZ2h0IHRvIHByZXZlbnQgY29udGVudCBqdW1waW5nXHJcbiAgICogd3JhcHMgdGhlIGVsZW1lbnQgaWYgbm90IGFscmVhZHkgd3JhcHBlZFxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgX3ByZXBhcmVNZW51KCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIC8vIGlmKCF0aGlzLm9wdGlvbnMuaG9sZE9wZW4pe1xyXG4gICAgLy8gICB0aGlzLl9tZW51TGlua0V2ZW50cygpO1xyXG4gICAgLy8gfVxyXG4gICAgdGhpcy4kc3VibWVudUFuY2hvcnMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICB2YXIgJGxpbmsgPSAkKHRoaXMpO1xyXG4gICAgICB2YXIgJHN1YiA9ICRsaW5rLnBhcmVudCgpO1xyXG4gICAgICBpZihfdGhpcy5vcHRpb25zLnBhcmVudExpbmspe1xyXG4gICAgICAgICRsaW5rLmNsb25lKCkucHJlcGVuZFRvKCRzdWIuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJykpLndyYXAoJzxsaSBjbGFzcz1cImlzLXN1Ym1lbnUtcGFyZW50LWl0ZW0gaXMtc3VibWVudS1pdGVtIGlzLWRyaWxsZG93bi1zdWJtZW51LWl0ZW1cIiByb2xlPVwibWVudS1pdGVtXCI+PC9saT4nKTtcclxuICAgICAgfVxyXG4gICAgICAkbGluay5kYXRhKCdzYXZlZEhyZWYnLCAkbGluay5hdHRyKCdocmVmJykpLnJlbW92ZUF0dHIoJ2hyZWYnKS5hdHRyKCd0YWJpbmRleCcsIDApO1xyXG4gICAgICAkbGluay5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKVxyXG4gICAgICAgICAgLmF0dHIoe1xyXG4gICAgICAgICAgICAnYXJpYS1oaWRkZW4nOiB0cnVlLFxyXG4gICAgICAgICAgICAndGFiaW5kZXgnOiAwLFxyXG4gICAgICAgICAgICAncm9sZSc6ICdtZW51J1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIF90aGlzLl9ldmVudHMoJGxpbmspO1xyXG4gICAgfSk7XHJcbiAgICB0aGlzLiRzdWJtZW51cy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciAkbWVudSA9ICQodGhpcyksXHJcbiAgICAgICAgICAkYmFjayA9ICRtZW51LmZpbmQoJy5qcy1kcmlsbGRvd24tYmFjaycpO1xyXG4gICAgICBpZighJGJhY2subGVuZ3RoKXtcclxuICAgICAgICBzd2l0Y2ggKF90aGlzLm9wdGlvbnMuYmFja0J1dHRvblBvc2l0aW9uKSB7XHJcbiAgICAgICAgICBjYXNlIFwiYm90dG9tXCI6XHJcbiAgICAgICAgICAgICRtZW51LmFwcGVuZChfdGhpcy5vcHRpb25zLmJhY2tCdXR0b24pO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGNhc2UgXCJ0b3BcIjpcclxuICAgICAgICAgICAgJG1lbnUucHJlcGVuZChfdGhpcy5vcHRpb25zLmJhY2tCdXR0b24pO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJVbnN1cHBvcnRlZCBiYWNrQnV0dG9uUG9zaXRpb24gdmFsdWUgJ1wiICsgX3RoaXMub3B0aW9ucy5iYWNrQnV0dG9uUG9zaXRpb24gKyBcIidcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIF90aGlzLl9iYWNrKCRtZW51KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmKCF0aGlzLm9wdGlvbnMuYXV0b0hlaWdodCkge1xyXG4gICAgICB0aGlzLiRzdWJtZW51cy5hZGRDbGFzcygnZHJpbGxkb3duLXN1Ym1lbnUtY292ZXItcHJldmlvdXMnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZighdGhpcy4kZWxlbWVudC5wYXJlbnQoKS5oYXNDbGFzcygnaXMtZHJpbGxkb3duJykpe1xyXG4gICAgICB0aGlzLiR3cmFwcGVyID0gJCh0aGlzLm9wdGlvbnMud3JhcHBlcikuYWRkQ2xhc3MoJ2lzLWRyaWxsZG93bicpO1xyXG4gICAgICBpZih0aGlzLm9wdGlvbnMuYW5pbWF0ZUhlaWdodCkgdGhpcy4kd3JhcHBlci5hZGRDbGFzcygnYW5pbWF0ZS1oZWlnaHQnKTtcclxuICAgICAgdGhpcy4kd3JhcHBlciA9IHRoaXMuJGVsZW1lbnQud3JhcCh0aGlzLiR3cmFwcGVyKS5wYXJlbnQoKS5jc3ModGhpcy5fZ2V0TWF4RGltcygpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIF9yZXNpemUoKSB7XHJcbiAgICB0aGlzLiR3cmFwcGVyLmNzcyh7J21heC13aWR0aCc6ICdub25lJywgJ21pbi1oZWlnaHQnOiAnbm9uZSd9KTtcclxuICAgIC8vIF9nZXRNYXhEaW1zIGhhcyBzaWRlIGVmZmVjdHMgKGJvbykgYnV0IGNhbGxpbmcgaXQgc2hvdWxkIHVwZGF0ZSBhbGwgb3RoZXIgbmVjZXNzYXJ5IGhlaWdodHMgJiB3aWR0aHNcclxuICAgIHRoaXMuJHdyYXBwZXIuY3NzKHRoaXMuX2dldE1heERpbXMoKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIHRvIGVsZW1lbnRzIGluIHRoZSBtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRlbGVtIC0gdGhlIGN1cnJlbnQgbWVudSBpdGVtIHRvIGFkZCBoYW5kbGVycyB0by5cclxuICAgKi9cclxuICBfZXZlbnRzKCRlbGVtKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgICRlbGVtLm9mZignY2xpY2suemYuZHJpbGxkb3duJylcclxuICAgIC5vbignY2xpY2suemYuZHJpbGxkb3duJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgIGlmKCQoZS50YXJnZXQpLnBhcmVudHNVbnRpbCgndWwnLCAnbGknKS5oYXNDbGFzcygnaXMtZHJpbGxkb3duLXN1Ym1lbnUtcGFyZW50Jykpe1xyXG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBpZihlLnRhcmdldCAhPT0gZS5jdXJyZW50VGFyZ2V0LmZpcnN0RWxlbWVudENoaWxkKXtcclxuICAgICAgLy8gICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIC8vIH1cclxuICAgICAgX3RoaXMuX3Nob3coJGVsZW0ucGFyZW50KCdsaScpKTtcclxuXHJcbiAgICAgIGlmKF90aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrKXtcclxuICAgICAgICB2YXIgJGJvZHkgPSAkKCdib2R5Jyk7XHJcbiAgICAgICAgJGJvZHkub2ZmKCcuemYuZHJpbGxkb3duJykub24oJ2NsaWNrLnpmLmRyaWxsZG93bicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgICAgaWYgKGUudGFyZ2V0ID09PSBfdGhpcy4kZWxlbWVudFswXSB8fCAkLmNvbnRhaW5zKF90aGlzLiRlbGVtZW50WzBdLCBlLnRhcmdldCkpIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBfdGhpcy5faGlkZUFsbCgpO1xyXG4gICAgICAgICAgJGJvZHkub2ZmKCcuemYuZHJpbGxkb3duJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cdCAgdGhpcy4kZWxlbWVudC5vbignbXV0YXRlbWUuemYudHJpZ2dlcicsIHRoaXMuX3Jlc2l6ZS5iaW5kKHRoaXMpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgdG8gdGhlIG1lbnUgZWxlbWVudC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9yZWdpc3RlckV2ZW50cygpIHtcclxuICAgIGlmKHRoaXMub3B0aW9ucy5zY3JvbGxUb3Ape1xyXG4gICAgICB0aGlzLl9iaW5kSGFuZGxlciA9IHRoaXMuX3Njcm9sbFRvcC5iaW5kKHRoaXMpO1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9uKCdvcGVuLnpmLmRyaWxsZG93biBoaWRlLnpmLmRyaWxsZG93biBjbG9zZWQuemYuZHJpbGxkb3duJyx0aGlzLl9iaW5kSGFuZGxlcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTY3JvbGwgdG8gVG9wIG9mIEVsZW1lbnQgb3IgZGF0YS1zY3JvbGwtdG9wLWVsZW1lbnRcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgRHJpbGxkb3duI3Njcm9sbG1lXHJcbiAgICovXHJcbiAgX3Njcm9sbFRvcCgpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB2YXIgJHNjcm9sbFRvcEVsZW1lbnQgPSBfdGhpcy5vcHRpb25zLnNjcm9sbFRvcEVsZW1lbnQhPScnPyQoX3RoaXMub3B0aW9ucy5zY3JvbGxUb3BFbGVtZW50KTpfdGhpcy4kZWxlbWVudCxcclxuICAgICAgICBzY3JvbGxQb3MgPSBwYXJzZUludCgkc2Nyb2xsVG9wRWxlbWVudC5vZmZzZXQoKS50b3ArX3RoaXMub3B0aW9ucy5zY3JvbGxUb3BPZmZzZXQpO1xyXG4gICAgJCgnaHRtbCwgYm9keScpLnN0b3AodHJ1ZSkuYW5pbWF0ZSh7IHNjcm9sbFRvcDogc2Nyb2xsUG9zIH0sIF90aGlzLm9wdGlvbnMuYW5pbWF0aW9uRHVyYXRpb24sIF90aGlzLm9wdGlvbnMuYW5pbWF0aW9uRWFzaW5nLGZ1bmN0aW9uKCl7XHJcbiAgICAgIC8qKlxyXG4gICAgICAgICogRmlyZXMgYWZ0ZXIgdGhlIG1lbnUgaGFzIHNjcm9sbGVkXHJcbiAgICAgICAgKiBAZXZlbnQgRHJpbGxkb3duI3Njcm9sbG1lXHJcbiAgICAgICAgKi9cclxuICAgICAgaWYodGhpcz09PSQoJ2h0bWwnKVswXSlfdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdzY3JvbGxtZS56Zi5kcmlsbGRvd24nKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBrZXlkb3duIGV2ZW50IGxpc3RlbmVyIHRvIGBsaWAncyBpbiB0aGUgbWVudS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9rZXlib2FyZEV2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kbWVudUl0ZW1zLmFkZCh0aGlzLiRlbGVtZW50LmZpbmQoJy5qcy1kcmlsbGRvd24tYmFjayA+IGEsIC5pcy1zdWJtZW51LXBhcmVudC1pdGVtID4gYScpKS5vbigna2V5ZG93bi56Zi5kcmlsbGRvd24nLCBmdW5jdGlvbihlKXtcclxuICAgICAgdmFyICRlbGVtZW50ID0gJCh0aGlzKSxcclxuICAgICAgICAgICRlbGVtZW50cyA9ICRlbGVtZW50LnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykuY2hpbGRyZW4oJ2xpJykuY2hpbGRyZW4oJ2EnKSxcclxuICAgICAgICAgICRwcmV2RWxlbWVudCxcclxuICAgICAgICAgICRuZXh0RWxlbWVudDtcclxuXHJcbiAgICAgICRlbGVtZW50cy5lYWNoKGZ1bmN0aW9uKGkpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS5pcygkZWxlbWVudCkpIHtcclxuICAgICAgICAgICRwcmV2RWxlbWVudCA9ICRlbGVtZW50cy5lcShNYXRoLm1heCgwLCBpLTEpKTtcclxuICAgICAgICAgICRuZXh0RWxlbWVudCA9ICRlbGVtZW50cy5lcShNYXRoLm1pbihpKzEsICRlbGVtZW50cy5sZW5ndGgtMSkpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnRHJpbGxkb3duJywge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKCRlbGVtZW50LmlzKF90aGlzLiRzdWJtZW51QW5jaG9ycykpIHtcclxuICAgICAgICAgICAgX3RoaXMuX3Nob3coJGVsZW1lbnQucGFyZW50KCdsaScpKTtcclxuICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQoJGVsZW1lbnQpLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5maW5kKCd1bCBsaSBhJykuZmlsdGVyKF90aGlzLiRtZW51SXRlbXMpLmZpcnN0KCkuZm9jdXMoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcHJldmlvdXM6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgX3RoaXMuX2hpZGUoJGVsZW1lbnQucGFyZW50KCdsaScpLnBhcmVudCgndWwnKSk7XHJcbiAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpLm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQoJGVsZW1lbnQpLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykucGFyZW50KCdsaScpLmNoaWxkcmVuKCdhJykuZmlyc3QoKS5mb2N1cygpO1xyXG4gICAgICAgICAgICB9LCAxKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB1cDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQuZm9jdXMoKTtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZG93bjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQuZm9jdXMoKTtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgX3RoaXMuX2JhY2soKTtcclxuICAgICAgICAgIC8vX3RoaXMuJG1lbnVJdGVtcy5maXJzdCgpLmZvY3VzKCk7IC8vIGZvY3VzIHRvIGZpcnN0IGVsZW1lbnRcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9wZW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKCEkZWxlbWVudC5pcyhfdGhpcy4kbWVudUl0ZW1zKSkgeyAvLyBub3QgbWVudSBpdGVtIG1lYW5zIGJhY2sgYnV0dG9uXHJcbiAgICAgICAgICAgIF90aGlzLl9oaWRlKCRlbGVtZW50LnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykpO1xyXG4gICAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpLm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQoJGVsZW1lbnQpLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpLnBhcmVudCgnbGknKS5jaGlsZHJlbignYScpLmZpcnN0KCkuZm9jdXMoKTtcclxuICAgICAgICAgICAgICB9LCAxKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgfSBlbHNlIGlmICgkZWxlbWVudC5pcyhfdGhpcy4kc3VibWVudUFuY2hvcnMpKSB7XHJcbiAgICAgICAgICAgIF90aGlzLl9zaG93KCRlbGVtZW50LnBhcmVudCgnbGknKSk7XHJcbiAgICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKCRlbGVtZW50KSwgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykuZmluZCgndWwgbGkgYScpLmZpbHRlcihfdGhpcy4kbWVudUl0ZW1zKS5maXJzdCgpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKHByZXZlbnREZWZhdWx0KSB7XHJcbiAgICAgICAgICBpZiAocHJldmVudERlZmF1bHQpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7IC8vIGVuZCBrZXlib2FyZEFjY2Vzc1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvc2VzIGFsbCBvcGVuIGVsZW1lbnRzLCBhbmQgcmV0dXJucyB0byByb290IG1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIERyaWxsZG93biNjbG9zZWRcclxuICAgKi9cclxuICBfaGlkZUFsbCgpIHtcclxuICAgIHZhciAkZWxlbSA9IHRoaXMuJGVsZW1lbnQuZmluZCgnLmlzLWRyaWxsZG93bi1zdWJtZW51LmlzLWFjdGl2ZScpLmFkZENsYXNzKCdpcy1jbG9zaW5nJyk7XHJcbiAgICBpZih0aGlzLm9wdGlvbnMuYXV0b0hlaWdodCkgdGhpcy4kd3JhcHBlci5jc3Moe2hlaWdodDokZWxlbS5wYXJlbnQoKS5jbG9zZXN0KCd1bCcpLmRhdGEoJ2NhbGNIZWlnaHQnKX0pO1xyXG4gICAgJGVsZW0ub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZCgkZWxlbSksIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAkZWxlbS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlIGlzLWNsb3NpbmcnKTtcclxuICAgIH0pO1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIG1lbnUgaXMgZnVsbHkgY2xvc2VkLlxyXG4gICAgICAgICAqIEBldmVudCBEcmlsbGRvd24jY2xvc2VkXHJcbiAgICAgICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2Nsb3NlZC56Zi5kcmlsbGRvd24nKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgbGlzdGVuZXIgZm9yIGVhY2ggYGJhY2tgIGJ1dHRvbiwgYW5kIGNsb3NlcyBvcGVuIG1lbnVzLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBEcmlsbGRvd24jYmFja1xyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxlbSAtIHRoZSBjdXJyZW50IHN1Yi1tZW51IHRvIGFkZCBgYmFja2AgZXZlbnQuXHJcbiAgICovXHJcbiAgX2JhY2soJGVsZW0pIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAkZWxlbS5vZmYoJ2NsaWNrLnpmLmRyaWxsZG93bicpO1xyXG4gICAgJGVsZW0uY2hpbGRyZW4oJy5qcy1kcmlsbGRvd24tYmFjaycpXHJcbiAgICAgIC5vbignY2xpY2suemYuZHJpbGxkb3duJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZygnbW91c2V1cCBvbiBiYWNrJyk7XHJcbiAgICAgICAgX3RoaXMuX2hpZGUoJGVsZW0pO1xyXG5cclxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBhIHBhcmVudCBzdWJtZW51LCBjYWxsIHNob3dcclxuICAgICAgICBsZXQgcGFyZW50U3ViTWVudSA9ICRlbGVtLnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykucGFyZW50KCdsaScpO1xyXG4gICAgICAgIGlmIChwYXJlbnRTdWJNZW51Lmxlbmd0aCkge1xyXG4gICAgICAgICAgX3RoaXMuX3Nob3cocGFyZW50U3ViTWVudSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgbGlzdGVuZXIgdG8gbWVudSBpdGVtcyB3L28gc3VibWVudXMgdG8gY2xvc2Ugb3BlbiBtZW51cyBvbiBjbGljay5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9tZW51TGlua0V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLiRtZW51SXRlbXMubm90KCcuaXMtZHJpbGxkb3duLXN1Ym1lbnUtcGFyZW50JylcclxuICAgICAgICAub2ZmKCdjbGljay56Zi5kcmlsbGRvd24nKVxyXG4gICAgICAgIC5vbignY2xpY2suemYuZHJpbGxkb3duJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgICAvLyBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICBfdGhpcy5faGlkZUFsbCgpO1xyXG4gICAgICAgICAgfSwgMCk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgYSBzdWJtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBEcmlsbGRvd24jb3BlblxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxlbSAtIHRoZSBjdXJyZW50IGVsZW1lbnQgd2l0aCBhIHN1Ym1lbnUgdG8gb3BlbiwgaS5lLiB0aGUgYGxpYCB0YWcuXHJcbiAgICovXHJcbiAgX3Nob3coJGVsZW0pIHtcclxuICAgIGlmKHRoaXMub3B0aW9ucy5hdXRvSGVpZ2h0KSB0aGlzLiR3cmFwcGVyLmNzcyh7aGVpZ2h0OiRlbGVtLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpLmRhdGEoJ2NhbGNIZWlnaHQnKX0pO1xyXG4gICAgJGVsZW0uYXR0cignYXJpYS1leHBhbmRlZCcsIHRydWUpO1xyXG4gICAgJGVsZW0uY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJykuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpLmF0dHIoJ2FyaWEtaGlkZGVuJywgZmFsc2UpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBzdWJtZW51IGhhcyBvcGVuZWQuXHJcbiAgICAgKiBAZXZlbnQgRHJpbGxkb3duI29wZW5cclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdvcGVuLnpmLmRyaWxsZG93bicsIFskZWxlbV0pO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIEhpZGVzIGEgc3VibWVudVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBEcmlsbGRvd24jaGlkZVxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxlbSAtIHRoZSBjdXJyZW50IHN1Yi1tZW51IHRvIGhpZGUsIGkuZS4gdGhlIGB1bGAgdGFnLlxyXG4gICAqL1xyXG4gIF9oaWRlKCRlbGVtKSB7XHJcbiAgICBpZih0aGlzLm9wdGlvbnMuYXV0b0hlaWdodCkgdGhpcy4kd3JhcHBlci5jc3Moe2hlaWdodDokZWxlbS5wYXJlbnQoKS5jbG9zZXN0KCd1bCcpLmRhdGEoJ2NhbGNIZWlnaHQnKX0pO1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICRlbGVtLnBhcmVudCgnbGknKS5hdHRyKCdhcmlhLWV4cGFuZGVkJywgZmFsc2UpO1xyXG4gICAgJGVsZW0uYXR0cignYXJpYS1oaWRkZW4nLCB0cnVlKS5hZGRDbGFzcygnaXMtY2xvc2luZycpXHJcbiAgICAkZWxlbS5hZGRDbGFzcygnaXMtY2xvc2luZycpXHJcbiAgICAgICAgIC5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKCRlbGVtKSwgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAkZWxlbS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlIGlzLWNsb3NpbmcnKTtcclxuICAgICAgICAgICAkZWxlbS5ibHVyKCk7XHJcbiAgICAgICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBzdWJtZW51IGhhcyBjbG9zZWQuXHJcbiAgICAgKiBAZXZlbnQgRHJpbGxkb3duI2hpZGVcclxuICAgICAqL1xyXG4gICAgJGVsZW0udHJpZ2dlcignaGlkZS56Zi5kcmlsbGRvd24nLCBbJGVsZW1dKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEl0ZXJhdGVzIHRocm91Z2ggdGhlIG5lc3RlZCBtZW51cyB0byBjYWxjdWxhdGUgdGhlIG1pbi1oZWlnaHQsIGFuZCBtYXgtd2lkdGggZm9yIHRoZSBtZW51LlxyXG4gICAqIFByZXZlbnRzIGNvbnRlbnQganVtcGluZy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9nZXRNYXhEaW1zKCkge1xyXG4gICAgdmFyICBtYXhIZWlnaHQgPSAwLCByZXN1bHQgPSB7fSwgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy4kc3VibWVudXMuYWRkKHRoaXMuJGVsZW1lbnQpLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgdmFyIG51bU9mRWxlbXMgPSAkKHRoaXMpLmNoaWxkcmVuKCdsaScpLmxlbmd0aDtcclxuICAgICAgdmFyIGhlaWdodCA9IEZvdW5kYXRpb24uQm94LkdldERpbWVuc2lvbnModGhpcykuaGVpZ2h0O1xyXG4gICAgICBtYXhIZWlnaHQgPSBoZWlnaHQgPiBtYXhIZWlnaHQgPyBoZWlnaHQgOiBtYXhIZWlnaHQ7XHJcbiAgICAgIGlmKF90aGlzLm9wdGlvbnMuYXV0b0hlaWdodCkge1xyXG4gICAgICAgICQodGhpcykuZGF0YSgnY2FsY0hlaWdodCcsaGVpZ2h0KTtcclxuICAgICAgICBpZiAoISQodGhpcykuaGFzQ2xhc3MoJ2lzLWRyaWxsZG93bi1zdWJtZW51JykpIHJlc3VsdFsnaGVpZ2h0J10gPSBoZWlnaHQ7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGlmKCF0aGlzLm9wdGlvbnMuYXV0b0hlaWdodCkgcmVzdWx0WydtaW4taGVpZ2h0J10gPSBgJHttYXhIZWlnaHR9cHhgO1xyXG5cclxuICAgIHJlc3VsdFsnbWF4LXdpZHRoJ10gPSBgJHt0aGlzLiRlbGVtZW50WzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRofXB4YDtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIERyaWxsZG93biBNZW51XHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIGlmKHRoaXMub3B0aW9ucy5zY3JvbGxUb3ApIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYuZHJpbGxkb3duJyx0aGlzLl9iaW5kSGFuZGxlcik7XHJcbiAgICB0aGlzLl9oaWRlQWxsKCk7XHJcblx0ICB0aGlzLiRlbGVtZW50Lm9mZignbXV0YXRlbWUuemYudHJpZ2dlcicpO1xyXG4gICAgRm91bmRhdGlvbi5OZXN0LkJ1cm4odGhpcy4kZWxlbWVudCwgJ2RyaWxsZG93bicpO1xyXG4gICAgdGhpcy4kZWxlbWVudC51bndyYXAoKVxyXG4gICAgICAgICAgICAgICAgIC5maW5kKCcuanMtZHJpbGxkb3duLWJhY2ssIC5pcy1zdWJtZW51LXBhcmVudC1pdGVtJykucmVtb3ZlKClcclxuICAgICAgICAgICAgICAgICAuZW5kKCkuZmluZCgnLmlzLWFjdGl2ZSwgLmlzLWNsb3NpbmcsIC5pcy1kcmlsbGRvd24tc3VibWVudScpLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUgaXMtY2xvc2luZyBpcy1kcmlsbGRvd24tc3VibWVudScpXHJcbiAgICAgICAgICAgICAgICAgLmVuZCgpLmZpbmQoJ1tkYXRhLXN1Ym1lbnVdJykucmVtb3ZlQXR0cignYXJpYS1oaWRkZW4gdGFiaW5kZXggcm9sZScpO1xyXG4gICAgdGhpcy4kc3VibWVudUFuY2hvcnMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgJCh0aGlzKS5vZmYoJy56Zi5kcmlsbGRvd24nKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuJHN1Ym1lbnVzLnJlbW92ZUNsYXNzKCdkcmlsbGRvd24tc3VibWVudS1jb3Zlci1wcmV2aW91cycpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnYScpLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgdmFyICRsaW5rID0gJCh0aGlzKTtcclxuICAgICAgJGxpbmsucmVtb3ZlQXR0cigndGFiaW5kZXgnKTtcclxuICAgICAgaWYoJGxpbmsuZGF0YSgnc2F2ZWRIcmVmJykpe1xyXG4gICAgICAgICRsaW5rLmF0dHIoJ2hyZWYnLCAkbGluay5kYXRhKCdzYXZlZEhyZWYnKSkucmVtb3ZlRGF0YSgnc2F2ZWRIcmVmJyk7XHJcbiAgICAgIH1lbHNleyByZXR1cm47IH1cclxuICAgIH0pO1xyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH07XHJcbn1cclxuXHJcbkRyaWxsZG93bi5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBNYXJrdXAgdXNlZCBmb3IgSlMgZ2VuZXJhdGVkIGJhY2sgYnV0dG9uLiBQcmVwZW5kZWQgIG9yIGFwcGVuZGVkIChzZWUgYmFja0J1dHRvblBvc2l0aW9uKSB0byBzdWJtZW51IGxpc3RzIGFuZCBkZWxldGVkIG9uIGBkZXN0cm95YCBtZXRob2QsICdqcy1kcmlsbGRvd24tYmFjaycgY2xhc3MgcmVxdWlyZWQuIFJlbW92ZSB0aGUgYmFja3NsYXNoIChgXFxgKSBpZiBjb3B5IGFuZCBwYXN0aW5nLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnPFxcbGk+PFxcYT5CYWNrPFxcL2E+PFxcL2xpPidcclxuICAgKi9cclxuICBiYWNrQnV0dG9uOiAnPGxpIGNsYXNzPVwianMtZHJpbGxkb3duLWJhY2tcIj48YSB0YWJpbmRleD1cIjBcIj5CYWNrPC9hPjwvbGk+JyxcclxuICAvKipcclxuICAgKiBQb3NpdGlvbiB0aGUgYmFjayBidXR0b24gZWl0aGVyIGF0IHRoZSB0b3Agb3IgYm90dG9tIG9mIGRyaWxsZG93biBzdWJtZW51cy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgYm90dG9tXHJcbiAgICovXHJcbiAgYmFja0J1dHRvblBvc2l0aW9uOiAndG9wJyxcclxuICAvKipcclxuICAgKiBNYXJrdXAgdXNlZCB0byB3cmFwIGRyaWxsZG93biBtZW51LiBVc2UgYSBjbGFzcyBuYW1lIGZvciBpbmRlcGVuZGVudCBzdHlsaW5nOyB0aGUgSlMgYXBwbGllZCBjbGFzczogYGlzLWRyaWxsZG93bmAgaXMgcmVxdWlyZWQuIFJlbW92ZSB0aGUgYmFja3NsYXNoIChgXFxgKSBpZiBjb3B5IGFuZCBwYXN0aW5nLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnPFxcZGl2IGNsYXNzPVwiaXMtZHJpbGxkb3duXCI+PFxcL2Rpdj4nXHJcbiAgICovXHJcbiAgd3JhcHBlcjogJzxkaXY+PC9kaXY+JyxcclxuICAvKipcclxuICAgKiBBZGRzIHRoZSBwYXJlbnQgbGluayB0byB0aGUgc3VibWVudS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBwYXJlbnRMaW5rOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgbWVudSB0byByZXR1cm4gdG8gcm9vdCBsaXN0IG9uIGJvZHkgY2xpY2suXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgY2xvc2VPbkNsaWNrOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgbWVudSB0byBhdXRvIGFkanVzdCBoZWlnaHQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYXV0b0hlaWdodDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQW5pbWF0ZSB0aGUgYXV0byBhZGp1c3QgaGVpZ2h0LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGFuaW1hdGVIZWlnaHQ6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIFNjcm9sbCB0byB0aGUgdG9wIG9mIHRoZSBtZW51IGFmdGVyIG9wZW5pbmcgYSBzdWJtZW51IG9yIG5hdmlnYXRpbmcgYmFjayB1c2luZyB0aGUgbWVudSBiYWNrIGJ1dHRvblxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIHNjcm9sbFRvcDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogU3RyaW5nIGpxdWVyeSBzZWxlY3RvciAoZm9yIGV4YW1wbGUgJ2JvZHknKSBvZiBlbGVtZW50IHRvIHRha2Ugb2Zmc2V0KCkudG9wIGZyb20sIGlmIGVtcHR5IHN0cmluZyB0aGUgZHJpbGxkb3duIG1lbnUgb2Zmc2V0KCkudG9wIGlzIHRha2VuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICcnXHJcbiAgICovXHJcbiAgc2Nyb2xsVG9wRWxlbWVudDogJycsXHJcbiAgLyoqXHJcbiAgICogU2Nyb2xsVG9wIG9mZnNldFxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMDBcclxuICAgKi9cclxuICBzY3JvbGxUb3BPZmZzZXQ6IDAsXHJcbiAgLyoqXHJcbiAgICogU2Nyb2xsIGFuaW1hdGlvbiBkdXJhdGlvblxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MDBcclxuICAgKi9cclxuICBhbmltYXRpb25EdXJhdGlvbjogNTAwLFxyXG4gIC8qKlxyXG4gICAqIFNjcm9sbCBhbmltYXRpb24gZWFzaW5nXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdzd2luZydcclxuICAgKi9cclxuICBhbmltYXRpb25FYXNpbmc6ICdzd2luZydcclxuICAvLyBob2xkT3BlbjogZmFsc2VcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKERyaWxsZG93biwgJ0RyaWxsZG93bicpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIERyb3Bkb3duIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmRyb3Bkb3duXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5ib3hcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKi9cclxuXHJcbmNsYXNzIERyb3Bkb3duIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGEgZHJvcGRvd24uXHJcbiAgICogQGNsYXNzXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhIGRyb3Bkb3duLlxyXG4gICAqICAgICAgICBPYmplY3Qgc2hvdWxkIGJlIG9mIHRoZSBkcm9wZG93biBwYW5lbCwgcmF0aGVyIHRoYW4gaXRzIGFuY2hvci5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgRHJvcGRvd24uZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdEcm9wZG93bicpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignRHJvcGRvd24nLCB7XHJcbiAgICAgICdFTlRFUic6ICdvcGVuJyxcclxuICAgICAgJ1NQQUNFJzogJ29wZW4nLFxyXG4gICAgICAnRVNDQVBFJzogJ2Nsb3NlJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgcGx1Z2luIGJ5IHNldHRpbmcvY2hlY2tpbmcgb3B0aW9ucyBhbmQgYXR0cmlidXRlcywgYWRkaW5nIGhlbHBlciB2YXJpYWJsZXMsIGFuZCBzYXZpbmcgdGhlIGFuY2hvci5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyICRpZCA9IHRoaXMuJGVsZW1lbnQuYXR0cignaWQnKTtcclxuXHJcbiAgICB0aGlzLiRhbmNob3IgPSAkKGBbZGF0YS10b2dnbGU9XCIkeyRpZH1cIl1gKS5sZW5ndGggPyAkKGBbZGF0YS10b2dnbGU9XCIkeyRpZH1cIl1gKSA6ICQoYFtkYXRhLW9wZW49XCIkeyRpZH1cIl1gKTtcclxuICAgIHRoaXMuJGFuY2hvci5hdHRyKHtcclxuICAgICAgJ2FyaWEtY29udHJvbHMnOiAkaWQsXHJcbiAgICAgICdkYXRhLWlzLWZvY3VzJzogZmFsc2UsXHJcbiAgICAgICdkYXRhLXlldGktYm94JzogJGlkLFxyXG4gICAgICAnYXJpYS1oYXNwb3B1cCc6IHRydWUsXHJcbiAgICAgICdhcmlhLWV4cGFuZGVkJzogZmFsc2VcclxuXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZih0aGlzLm9wdGlvbnMucGFyZW50Q2xhc3Mpe1xyXG4gICAgICB0aGlzLiRwYXJlbnQgPSB0aGlzLiRlbGVtZW50LnBhcmVudHMoJy4nICsgdGhpcy5vcHRpb25zLnBhcmVudENsYXNzKTtcclxuICAgIH1lbHNle1xyXG4gICAgICB0aGlzLiRwYXJlbnQgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgdGhpcy5vcHRpb25zLnBvc2l0aW9uQ2xhc3MgPSB0aGlzLmdldFBvc2l0aW9uQ2xhc3MoKTtcclxuICAgIHRoaXMuY291bnRlciA9IDQ7XHJcbiAgICB0aGlzLnVzZWRQb3NpdGlvbnMgPSBbXTtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cih7XHJcbiAgICAgICdhcmlhLWhpZGRlbic6ICd0cnVlJyxcclxuICAgICAgJ2RhdGEteWV0aS1ib3gnOiAkaWQsXHJcbiAgICAgICdkYXRhLXJlc2l6ZSc6ICRpZCxcclxuICAgICAgJ2FyaWEtbGFiZWxsZWRieSc6IHRoaXMuJGFuY2hvclswXS5pZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdkZC1hbmNob3InKVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byBkZXRlcm1pbmUgY3VycmVudCBvcmllbnRhdGlvbiBvZiBkcm9wZG93biBwYW5lLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IHBvc2l0aW9uIC0gc3RyaW5nIHZhbHVlIG9mIGEgcG9zaXRpb24gY2xhc3MuXHJcbiAgICovXHJcbiAgZ2V0UG9zaXRpb25DbGFzcygpIHtcclxuICAgIHZhciB2ZXJ0aWNhbFBvc2l0aW9uID0gdGhpcy4kZWxlbWVudFswXS5jbGFzc05hbWUubWF0Y2goLyh0b3B8bGVmdHxyaWdodHxib3R0b20pL2cpO1xyXG4gICAgICAgIHZlcnRpY2FsUG9zaXRpb24gPSB2ZXJ0aWNhbFBvc2l0aW9uID8gdmVydGljYWxQb3NpdGlvblswXSA6ICcnO1xyXG4gICAgdmFyIGhvcml6b250YWxQb3NpdGlvbiA9IC9mbG9hdC0oXFxTKykvLmV4ZWModGhpcy4kYW5jaG9yWzBdLmNsYXNzTmFtZSk7XHJcbiAgICAgICAgaG9yaXpvbnRhbFBvc2l0aW9uID0gaG9yaXpvbnRhbFBvc2l0aW9uID8gaG9yaXpvbnRhbFBvc2l0aW9uWzFdIDogJyc7XHJcbiAgICB2YXIgcG9zaXRpb24gPSBob3Jpem9udGFsUG9zaXRpb24gPyBob3Jpem9udGFsUG9zaXRpb24gKyAnICcgKyB2ZXJ0aWNhbFBvc2l0aW9uIDogdmVydGljYWxQb3NpdGlvbjtcclxuXHJcbiAgICByZXR1cm4gcG9zaXRpb247XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGp1c3RzIHRoZSBkcm9wZG93biBwYW5lcyBvcmllbnRhdGlvbiBieSBhZGRpbmcvcmVtb3ZpbmcgcG9zaXRpb25pbmcgY2xhc3Nlcy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwb3NpdGlvbiAtIHBvc2l0aW9uIGNsYXNzIHRvIHJlbW92ZS5cclxuICAgKi9cclxuICBfcmVwb3NpdGlvbihwb3NpdGlvbikge1xyXG4gICAgdGhpcy51c2VkUG9zaXRpb25zLnB1c2gocG9zaXRpb24gPyBwb3NpdGlvbiA6ICdib3R0b20nKTtcclxuICAgIC8vZGVmYXVsdCwgdHJ5IHN3aXRjaGluZyB0byBvcHBvc2l0ZSBzaWRlXHJcbiAgICBpZighcG9zaXRpb24gJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCd0b3AnKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcygndG9wJyk7XHJcbiAgICB9ZWxzZSBpZihwb3NpdGlvbiA9PT0gJ3RvcCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9ZWxzZSBpZihwb3NpdGlvbiA9PT0gJ2xlZnQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigncmlnaHQnKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhwb3NpdGlvbilcclxuICAgICAgICAgIC5hZGRDbGFzcygncmlnaHQnKTtcclxuICAgIH1lbHNlIGlmKHBvc2l0aW9uID09PSAncmlnaHQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHBvc2l0aW9uKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdsZWZ0Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy9pZiBkZWZhdWx0IGNoYW5nZSBkaWRuJ3Qgd29yaywgdHJ5IGJvdHRvbSBvciBsZWZ0IGZpcnN0XHJcbiAgICBlbHNlIGlmKCFwb3NpdGlvbiAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3RvcCcpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKCdsZWZ0Jyk7XHJcbiAgICB9ZWxzZSBpZihwb3NpdGlvbiA9PT0gJ3RvcCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhwb3NpdGlvbilcclxuICAgICAgICAgIC5hZGRDbGFzcygnbGVmdCcpO1xyXG4gICAgfWVsc2UgaWYocG9zaXRpb24gPT09ICdsZWZ0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3JpZ2h0JykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9ZWxzZSBpZihwb3NpdGlvbiA9PT0gJ3JpZ2h0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpIDwgMCkpe1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH1cclxuICAgIC8vaWYgbm90aGluZyBjbGVhcmVkLCBzZXQgdG8gYm90dG9tXHJcbiAgICBlbHNle1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH1cclxuICAgIHRoaXMuY2xhc3NDaGFuZ2VkID0gdHJ1ZTtcclxuICAgIHRoaXMuY291bnRlci0tO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgcG9zaXRpb24gYW5kIG9yaWVudGF0aW9uIG9mIHRoZSBkcm9wZG93biBwYW5lLCBjaGVja3MgZm9yIGNvbGxpc2lvbnMuXHJcbiAgICogUmVjdXJzaXZlbHkgY2FsbHMgaXRzZWxmIGlmIGEgY29sbGlzaW9uIGlzIGRldGVjdGVkLCB3aXRoIGEgbmV3IHBvc2l0aW9uIGNsYXNzLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3NldFBvc2l0aW9uKCkge1xyXG4gICAgaWYodGhpcy4kYW5jaG9yLmF0dHIoJ2FyaWEtZXhwYW5kZWQnKSA9PT0gJ2ZhbHNlJyl7IHJldHVybiBmYWxzZTsgfVxyXG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5nZXRQb3NpdGlvbkNsYXNzKCksXHJcbiAgICAgICAgJGVsZURpbXMgPSBGb3VuZGF0aW9uLkJveC5HZXREaW1lbnNpb25zKHRoaXMuJGVsZW1lbnQpLFxyXG4gICAgICAgICRhbmNob3JEaW1zID0gRm91bmRhdGlvbi5Cb3guR2V0RGltZW5zaW9ucyh0aGlzLiRhbmNob3IpLFxyXG4gICAgICAgIF90aGlzID0gdGhpcyxcclxuICAgICAgICBkaXJlY3Rpb24gPSAocG9zaXRpb24gPT09ICdsZWZ0JyA/ICdsZWZ0JyA6ICgocG9zaXRpb24gPT09ICdyaWdodCcpID8gJ2xlZnQnIDogJ3RvcCcpKSxcclxuICAgICAgICBwYXJhbSA9IChkaXJlY3Rpb24gPT09ICd0b3AnKSA/ICdoZWlnaHQnIDogJ3dpZHRoJyxcclxuICAgICAgICBvZmZzZXQgPSAocGFyYW0gPT09ICdoZWlnaHQnKSA/IHRoaXMub3B0aW9ucy52T2Zmc2V0IDogdGhpcy5vcHRpb25zLmhPZmZzZXQ7XHJcblxyXG4gICAgaWYoKCRlbGVEaW1zLndpZHRoID49ICRlbGVEaW1zLndpbmRvd0RpbXMud2lkdGgpIHx8ICghdGhpcy5jb3VudGVyICYmICFGb3VuZGF0aW9uLkJveC5JbU5vdFRvdWNoaW5nWW91KHRoaXMuJGVsZW1lbnQsIHRoaXMuJHBhcmVudCkpKXtcclxuICAgICAgdmFyIG5ld1dpZHRoID0gJGVsZURpbXMud2luZG93RGltcy53aWR0aCxcclxuICAgICAgICAgIHBhcmVudEhPZmZzZXQgPSAwO1xyXG4gICAgICBpZih0aGlzLiRwYXJlbnQpe1xyXG4gICAgICAgIHZhciAkcGFyZW50RGltcyA9IEZvdW5kYXRpb24uQm94LkdldERpbWVuc2lvbnModGhpcy4kcGFyZW50KSxcclxuICAgICAgICAgICAgcGFyZW50SE9mZnNldCA9ICRwYXJlbnREaW1zLm9mZnNldC5sZWZ0O1xyXG4gICAgICAgIGlmICgkcGFyZW50RGltcy53aWR0aCA8IG5ld1dpZHRoKXtcclxuICAgICAgICAgIG5ld1dpZHRoID0gJHBhcmVudERpbXMud2lkdGg7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9mZnNldChGb3VuZGF0aW9uLkJveC5HZXRPZmZzZXRzKHRoaXMuJGVsZW1lbnQsIHRoaXMuJGFuY2hvciwgJ2NlbnRlciBib3R0b20nLCB0aGlzLm9wdGlvbnMudk9mZnNldCwgdGhpcy5vcHRpb25zLmhPZmZzZXQgKyBwYXJlbnRIT2Zmc2V0LCB0cnVlKSkuY3NzKHtcclxuICAgICAgICAnd2lkdGgnOiBuZXdXaWR0aCAtICh0aGlzLm9wdGlvbnMuaE9mZnNldCAqIDIpLFxyXG4gICAgICAgICdoZWlnaHQnOiAnYXV0bydcclxuICAgICAgfSk7XHJcbiAgICAgIHRoaXMuY2xhc3NDaGFuZ2VkID0gdHJ1ZTtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub2Zmc2V0KEZvdW5kYXRpb24uQm94LkdldE9mZnNldHModGhpcy4kZWxlbWVudCwgdGhpcy4kYW5jaG9yLCBwb3NpdGlvbiwgdGhpcy5vcHRpb25zLnZPZmZzZXQsIHRoaXMub3B0aW9ucy5oT2Zmc2V0KSk7XHJcblxyXG4gICAgd2hpbGUoIUZvdW5kYXRpb24uQm94LkltTm90VG91Y2hpbmdZb3UodGhpcy4kZWxlbWVudCwgdGhpcy4kcGFyZW50LCB0cnVlKSAmJiB0aGlzLmNvdW50ZXIpe1xyXG4gICAgICB0aGlzLl9yZXBvc2l0aW9uKHBvc2l0aW9uKTtcclxuICAgICAgdGhpcy5fc2V0UG9zaXRpb24oKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBlbGVtZW50IHV0aWxpemluZyB0aGUgdHJpZ2dlcnMgdXRpbGl0eSBsaWJyYXJ5LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uKHtcclxuICAgICAgJ29wZW4uemYudHJpZ2dlcic6IHRoaXMub3Blbi5iaW5kKHRoaXMpLFxyXG4gICAgICAnY2xvc2UuemYudHJpZ2dlcic6IHRoaXMuY2xvc2UuYmluZCh0aGlzKSxcclxuICAgICAgJ3RvZ2dsZS56Zi50cmlnZ2VyJzogdGhpcy50b2dnbGUuYmluZCh0aGlzKSxcclxuICAgICAgJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInOiB0aGlzLl9zZXRQb3NpdGlvbi5iaW5kKHRoaXMpXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZih0aGlzLm9wdGlvbnMuaG92ZXIpe1xyXG4gICAgICB0aGlzLiRhbmNob3Iub2ZmKCdtb3VzZWVudGVyLnpmLmRyb3Bkb3duIG1vdXNlbGVhdmUuemYuZHJvcGRvd24nKVxyXG4gICAgICAub24oJ21vdXNlZW50ZXIuemYuZHJvcGRvd24nLCBmdW5jdGlvbigpe1xyXG4gICAgICAgIHZhciBib2R5RGF0YSA9ICQoJ2JvZHknKS5kYXRhKCk7XHJcbiAgICAgICAgaWYodHlwZW9mKGJvZHlEYXRhLndoYXRpbnB1dCkgPT09ICd1bmRlZmluZWQnIHx8IGJvZHlEYXRhLndoYXRpbnB1dCA9PT0gJ21vdXNlJykge1xyXG4gICAgICAgICAgY2xlYXJUaW1lb3V0KF90aGlzLnRpbWVvdXQpO1xyXG4gICAgICAgICAgX3RoaXMudGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgX3RoaXMub3BlbigpO1xyXG4gICAgICAgICAgICBfdGhpcy4kYW5jaG9yLmRhdGEoJ2hvdmVyJywgdHJ1ZSk7XHJcbiAgICAgICAgICB9LCBfdGhpcy5vcHRpb25zLmhvdmVyRGVsYXkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkub24oJ21vdXNlbGVhdmUuemYuZHJvcGRvd24nLCBmdW5jdGlvbigpe1xyXG4gICAgICAgIGNsZWFyVGltZW91dChfdGhpcy50aW1lb3V0KTtcclxuICAgICAgICBfdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgICAgIF90aGlzLiRhbmNob3IuZGF0YSgnaG92ZXInLCBmYWxzZSk7XHJcbiAgICAgICAgfSwgX3RoaXMub3B0aW9ucy5ob3ZlckRlbGF5KTtcclxuICAgICAgfSk7XHJcbiAgICAgIGlmKHRoaXMub3B0aW9ucy5ob3ZlclBhbmUpe1xyXG4gICAgICAgIHRoaXMuJGVsZW1lbnQub2ZmKCdtb3VzZWVudGVyLnpmLmRyb3Bkb3duIG1vdXNlbGVhdmUuemYuZHJvcGRvd24nKVxyXG4gICAgICAgICAgICAub24oJ21vdXNlZW50ZXIuemYuZHJvcGRvd24nLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgIGNsZWFyVGltZW91dChfdGhpcy50aW1lb3V0KTtcclxuICAgICAgICAgICAgfSkub24oJ21vdXNlbGVhdmUuemYuZHJvcGRvd24nLCBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgIGNsZWFyVGltZW91dChfdGhpcy50aW1lb3V0KTtcclxuICAgICAgICAgICAgICBfdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgICAgICAgICAgIF90aGlzLiRhbmNob3IuZGF0YSgnaG92ZXInLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgfSwgX3RoaXMub3B0aW9ucy5ob3ZlckRlbGF5KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHRoaXMuJGFuY2hvci5hZGQodGhpcy4kZWxlbWVudCkub24oJ2tleWRvd24uemYuZHJvcGRvd24nLCBmdW5jdGlvbihlKSB7XHJcblxyXG4gICAgICB2YXIgJHRhcmdldCA9ICQodGhpcyksXHJcbiAgICAgICAgdmlzaWJsZUZvY3VzYWJsZUVsZW1lbnRzID0gRm91bmRhdGlvbi5LZXlib2FyZC5maW5kRm9jdXNhYmxlKF90aGlzLiRlbGVtZW50KTtcclxuXHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdEcm9wZG93bicsIHtcclxuICAgICAgICBvcGVuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICgkdGFyZ2V0LmlzKF90aGlzLiRhbmNob3IpKSB7XHJcbiAgICAgICAgICAgIF90aGlzLm9wZW4oKTtcclxuICAgICAgICAgICAgX3RoaXMuJGVsZW1lbnQuYXR0cigndGFiaW5kZXgnLCAtMSkuZm9jdXMoKTtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgICAgIF90aGlzLiRhbmNob3IuZm9jdXMoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGFuIGV2ZW50IGhhbmRsZXIgdG8gdGhlIGJvZHkgdG8gY2xvc2UgYW55IGRyb3Bkb3ducyBvbiBhIGNsaWNrLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2FkZEJvZHlIYW5kbGVyKCkge1xyXG4gICAgIHZhciAkYm9keSA9ICQoZG9jdW1lbnQuYm9keSkubm90KHRoaXMuJGVsZW1lbnQpLFxyXG4gICAgICAgICBfdGhpcyA9IHRoaXM7XHJcbiAgICAgJGJvZHkub2ZmKCdjbGljay56Zi5kcm9wZG93bicpXHJcbiAgICAgICAgICAub24oJ2NsaWNrLnpmLmRyb3Bkb3duJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgICAgIGlmKF90aGlzLiRhbmNob3IuaXMoZS50YXJnZXQpIHx8IF90aGlzLiRhbmNob3IuZmluZChlLnRhcmdldCkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmKF90aGlzLiRlbGVtZW50LmZpbmQoZS50YXJnZXQpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgICAgICAkYm9keS5vZmYoJ2NsaWNrLnpmLmRyb3Bkb3duJyk7XHJcbiAgICAgICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIHRoZSBkcm9wZG93biBwYW5lLCBhbmQgZmlyZXMgYSBidWJibGluZyBldmVudCB0byBjbG9zZSBvdGhlciBkcm9wZG93bnMuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIERyb3Bkb3duI2Nsb3NlbWVcclxuICAgKiBAZmlyZXMgRHJvcGRvd24jc2hvd1xyXG4gICAqL1xyXG4gIG9wZW4oKSB7XHJcbiAgICAvLyB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB0byBjbG9zZSBvdGhlciBvcGVuIGRyb3Bkb3duc1xyXG4gICAgICogQGV2ZW50IERyb3Bkb3duI2Nsb3NlbWVcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjbG9zZW1lLnpmLmRyb3Bkb3duJywgdGhpcy4kZWxlbWVudC5hdHRyKCdpZCcpKTtcclxuICAgIHRoaXMuJGFuY2hvci5hZGRDbGFzcygnaG92ZXInKVxyXG4gICAgICAgIC5hdHRyKHsnYXJpYS1leHBhbmRlZCc6IHRydWV9KTtcclxuICAgIC8vIHRoaXMuJGVsZW1lbnQvKi5zaG93KCkqLztcclxuICAgIHRoaXMuX3NldFBvc2l0aW9uKCk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKCdpcy1vcGVuJylcclxuICAgICAgICAuYXR0cih7J2FyaWEtaGlkZGVuJzogZmFsc2V9KTtcclxuXHJcbiAgICBpZih0aGlzLm9wdGlvbnMuYXV0b0ZvY3VzKXtcclxuICAgICAgdmFyICRmb2N1c2FibGUgPSBGb3VuZGF0aW9uLktleWJvYXJkLmZpbmRGb2N1c2FibGUodGhpcy4kZWxlbWVudCk7XHJcbiAgICAgIGlmKCRmb2N1c2FibGUubGVuZ3RoKXtcclxuICAgICAgICAkZm9jdXNhYmxlLmVxKDApLmZvY3VzKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZih0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrKXsgdGhpcy5fYWRkQm9keUhhbmRsZXIoKTsgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudHJhcEZvY3VzKSB7XHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQudHJhcEZvY3VzKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgb25jZSB0aGUgZHJvcGRvd24gaXMgdmlzaWJsZS5cclxuICAgICAqIEBldmVudCBEcm9wZG93biNzaG93XHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignc2hvdy56Zi5kcm9wZG93bicsIFt0aGlzLiRlbGVtZW50XSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9zZXMgdGhlIG9wZW4gZHJvcGRvd24gcGFuZS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgRHJvcGRvd24jaGlkZVxyXG4gICAqL1xyXG4gIGNsb3NlKCkge1xyXG4gICAgaWYoIXRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2lzLW9wZW4nKSl7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2lzLW9wZW4nKVxyXG4gICAgICAgIC5hdHRyKHsnYXJpYS1oaWRkZW4nOiB0cnVlfSk7XHJcblxyXG4gICAgdGhpcy4kYW5jaG9yLnJlbW92ZUNsYXNzKCdob3ZlcicpXHJcbiAgICAgICAgLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCBmYWxzZSk7XHJcblxyXG4gICAgaWYodGhpcy5jbGFzc0NoYW5nZWQpe1xyXG4gICAgICB2YXIgY3VyUG9zaXRpb25DbGFzcyA9IHRoaXMuZ2V0UG9zaXRpb25DbGFzcygpO1xyXG4gICAgICBpZihjdXJQb3NpdGlvbkNsYXNzKXtcclxuICAgICAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKGN1clBvc2l0aW9uQ2xhc3MpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLnBvc2l0aW9uQ2xhc3MpXHJcbiAgICAgICAgICAvKi5oaWRlKCkqLy5jc3Moe2hlaWdodDogJycsIHdpZHRoOiAnJ30pO1xyXG4gICAgICB0aGlzLmNsYXNzQ2hhbmdlZCA9IGZhbHNlO1xyXG4gICAgICB0aGlzLmNvdW50ZXIgPSA0O1xyXG4gICAgICB0aGlzLnVzZWRQb3NpdGlvbnMubGVuZ3RoID0gMDtcclxuICAgIH1cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignaGlkZS56Zi5kcm9wZG93bicsIFt0aGlzLiRlbGVtZW50XSk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy50cmFwRm9jdXMpIHtcclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWxlYXNlRm9jdXModGhpcy4kZWxlbWVudCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHRoZSBkcm9wZG93biBwYW5lJ3MgdmlzaWJpbGl0eS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICB0b2dnbGUoKSB7XHJcbiAgICBpZih0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1vcGVuJykpe1xyXG4gICAgICBpZih0aGlzLiRhbmNob3IuZGF0YSgnaG92ZXInKSkgcmV0dXJuO1xyXG4gICAgICB0aGlzLmNsb3NlKCk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgdGhpcy5vcGVuKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgZHJvcGRvd24uXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYudHJpZ2dlcicpLmhpZGUoKTtcclxuICAgIHRoaXMuJGFuY2hvci5vZmYoJy56Zi5kcm9wZG93bicpO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbkRyb3Bkb3duLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIENsYXNzIHRoYXQgZGVzaWduYXRlcyBib3VuZGluZyBjb250YWluZXIgb2YgRHJvcGRvd24gKERlZmF1bHQ6IHdpbmRvdylcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2Ryb3Bkb3duLXBhcmVudCdcclxuICAgKi9cclxuICBwYXJlbnRDbGFzczogbnVsbCxcclxuICAvKipcclxuICAgKiBBbW91bnQgb2YgdGltZSB0byBkZWxheSBvcGVuaW5nIGEgc3VibWVudSBvbiBob3ZlciBldmVudC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMjUwXHJcbiAgICovXHJcbiAgaG92ZXJEZWxheTogMjUwLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHN1Ym1lbnVzIHRvIG9wZW4gb24gaG92ZXIgZXZlbnRzXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgaG92ZXI6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIERvbid0IGNsb3NlIGRyb3Bkb3duIHdoZW4gaG92ZXJpbmcgb3ZlciBkcm9wZG93biBwYW5lXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBob3ZlclBhbmU6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIE51bWJlciBvZiBwaXhlbHMgYmV0d2VlbiB0aGUgZHJvcGRvd24gcGFuZSBhbmQgdGhlIHRyaWdnZXJpbmcgZWxlbWVudCBvbiBvcGVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxXHJcbiAgICovXHJcbiAgdk9mZnNldDogMSxcclxuICAvKipcclxuICAgKiBOdW1iZXIgb2YgcGl4ZWxzIGJldHdlZW4gdGhlIGRyb3Bkb3duIHBhbmUgYW5kIHRoZSB0cmlnZ2VyaW5nIGVsZW1lbnQgb24gb3Blbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMVxyXG4gICAqL1xyXG4gIGhPZmZzZXQ6IDEsXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byBhZGp1c3Qgb3BlbiBwb3NpdGlvbi4gSlMgd2lsbCB0ZXN0IGFuZCBmaWxsIHRoaXMgaW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICd0b3AnXHJcbiAgICovXHJcbiAgcG9zaXRpb25DbGFzczogJycsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIHBsdWdpbiB0byB0cmFwIGZvY3VzIHRvIHRoZSBkcm9wZG93biBwYW5lIGlmIG9wZW5lZCB3aXRoIGtleWJvYXJkIGNvbW1hbmRzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIHRyYXBGb2N1czogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIHBsdWdpbiB0byBzZXQgZm9jdXMgdG8gdGhlIGZpcnN0IGZvY3VzYWJsZSBlbGVtZW50IHdpdGhpbiB0aGUgcGFuZSwgcmVnYXJkbGVzcyBvZiBtZXRob2Qgb2Ygb3BlbmluZy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGF1dG9Gb2N1czogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIGEgY2xpY2sgb24gdGhlIGJvZHkgdG8gY2xvc2UgdGhlIGRyb3Bkb3duLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGNsb3NlT25DbGljazogZmFsc2VcclxufVxyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oRHJvcGRvd24sICdEcm9wZG93bicpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIERyb3Bkb3duTWVudSBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5kcm9wZG93bi1tZW51XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5ib3hcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5uZXN0XHJcbiAqL1xyXG5cclxuY2xhc3MgRHJvcGRvd25NZW51IHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIERyb3Bkb3duTWVudS5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgRHJvcGRvd25NZW51I2luaXRcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGEgZHJvcGRvd24gbWVudS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgRHJvcGRvd25NZW51LmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5OZXN0LkZlYXRoZXIodGhpcy4kZWxlbWVudCwgJ2Ryb3Bkb3duJyk7XHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnRHJvcGRvd25NZW51Jyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdEcm9wZG93bk1lbnUnLCB7XHJcbiAgICAgICdFTlRFUic6ICdvcGVuJyxcclxuICAgICAgJ1NQQUNFJzogJ29wZW4nLFxyXG4gICAgICAnQVJST1dfUklHSFQnOiAnbmV4dCcsXHJcbiAgICAgICdBUlJPV19VUCc6ICd1cCcsXHJcbiAgICAgICdBUlJPV19ET1dOJzogJ2Rvd24nLFxyXG4gICAgICAnQVJST1dfTEVGVCc6ICdwcmV2aW91cycsXHJcbiAgICAgICdFU0NBUEUnOiAnY2xvc2UnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBwbHVnaW4sIGFuZCBjYWxscyBfcHJlcGFyZU1lbnVcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIHN1YnMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50Jyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmNoaWxkcmVuKCcuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKS5jaGlsZHJlbignLmlzLWRyb3Bkb3duLXN1Ym1lbnUnKS5hZGRDbGFzcygnZmlyc3Qtc3ViJyk7XHJcblxyXG4gICAgdGhpcy4kbWVudUl0ZW1zID0gdGhpcy4kZWxlbWVudC5maW5kKCdbcm9sZT1cIm1lbnVpdGVtXCJdJyk7XHJcbiAgICB0aGlzLiR0YWJzID0gdGhpcy4kZWxlbWVudC5jaGlsZHJlbignW3JvbGU9XCJtZW51aXRlbVwiXScpO1xyXG4gICAgdGhpcy4kdGFicy5maW5kKCd1bC5pcy1kcm9wZG93bi1zdWJtZW51JykuYWRkQ2xhc3ModGhpcy5vcHRpb25zLnZlcnRpY2FsQ2xhc3MpO1xyXG5cclxuICAgIGlmICh0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKHRoaXMub3B0aW9ucy5yaWdodENsYXNzKSB8fCB0aGlzLm9wdGlvbnMuYWxpZ25tZW50ID09PSAncmlnaHQnIHx8IEZvdW5kYXRpb24ucnRsKCkgfHwgdGhpcy4kZWxlbWVudC5wYXJlbnRzKCcudG9wLWJhci1yaWdodCcpLmlzKCcqJykpIHtcclxuICAgICAgdGhpcy5vcHRpb25zLmFsaWdubWVudCA9ICdyaWdodCc7XHJcbiAgICAgIHN1YnMuYWRkQ2xhc3MoJ29wZW5zLWxlZnQnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHN1YnMuYWRkQ2xhc3MoJ29wZW5zLXJpZ2h0Jyk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNoYW5nZWQgPSBmYWxzZTtcclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH07XHJcblxyXG4gIF9pc1ZlcnRpY2FsKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuJHRhYnMuY3NzKCdkaXNwbGF5JykgPT09ICdibG9jayc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGxpc3RlbmVycyB0byBlbGVtZW50cyB3aXRoaW4gdGhlIG1lbnVcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIGhhc1RvdWNoID0gJ29udG91Y2hzdGFydCcgaW4gd2luZG93IHx8ICh0eXBlb2Ygd2luZG93Lm9udG91Y2hzdGFydCAhPT0gJ3VuZGVmaW5lZCcpLFxyXG4gICAgICAgIHBhckNsYXNzID0gJ2lzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50JztcclxuXHJcbiAgICAvLyB1c2VkIGZvciBvbkNsaWNrIGFuZCBpbiB0aGUga2V5Ym9hcmQgaGFuZGxlcnNcclxuICAgIHZhciBoYW5kbGVDbGlja0ZuID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICB2YXIgJGVsZW0gPSAkKGUudGFyZ2V0KS5wYXJlbnRzVW50aWwoJ3VsJywgYC4ke3BhckNsYXNzfWApLFxyXG4gICAgICAgICAgaGFzU3ViID0gJGVsZW0uaGFzQ2xhc3MocGFyQ2xhc3MpLFxyXG4gICAgICAgICAgaGFzQ2xpY2tlZCA9ICRlbGVtLmF0dHIoJ2RhdGEtaXMtY2xpY2snKSA9PT0gJ3RydWUnLFxyXG4gICAgICAgICAgJHN1YiA9ICRlbGVtLmNoaWxkcmVuKCcuaXMtZHJvcGRvd24tc3VibWVudScpO1xyXG5cclxuICAgICAgaWYgKGhhc1N1Yikge1xyXG4gICAgICAgIGlmIChoYXNDbGlja2VkKSB7XHJcbiAgICAgICAgICBpZiAoIV90aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrIHx8ICghX3RoaXMub3B0aW9ucy5jbGlja09wZW4gJiYgIWhhc1RvdWNoKSB8fCAoX3RoaXMub3B0aW9ucy5mb3JjZUZvbGxvdyAmJiBoYXNUb3VjaCkpIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBfdGhpcy5faGlkZSgkZWxlbSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICBfdGhpcy5fc2hvdygkc3ViKTtcclxuICAgICAgICAgICRlbGVtLmFkZCgkZWxlbS5wYXJlbnRzVW50aWwoX3RoaXMuJGVsZW1lbnQsIGAuJHtwYXJDbGFzc31gKSkuYXR0cignZGF0YS1pcy1jbGljaycsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsaWNrT3BlbiB8fCBoYXNUb3VjaCkge1xyXG4gICAgICB0aGlzLiRtZW51SXRlbXMub24oJ2NsaWNrLnpmLmRyb3Bkb3dubWVudSB0b3VjaHN0YXJ0LnpmLmRyb3Bkb3dubWVudScsIGhhbmRsZUNsaWNrRm4pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhhbmRsZSBMZWFmIGVsZW1lbnQgQ2xpY2tzXHJcbiAgICBpZihfdGhpcy5vcHRpb25zLmNsb3NlT25DbGlja0luc2lkZSl7XHJcbiAgICAgIHRoaXMuJG1lbnVJdGVtcy5vbignY2xpY2suemYuZHJvcGRvd25tZW51IHRvdWNoZW5kLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICB2YXIgJGVsZW0gPSAkKHRoaXMpLFxyXG4gICAgICAgICAgICBoYXNTdWIgPSAkZWxlbS5oYXNDbGFzcyhwYXJDbGFzcyk7XHJcbiAgICAgICAgaWYoIWhhc1N1Yil7XHJcbiAgICAgICAgICBfdGhpcy5faGlkZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZGlzYWJsZUhvdmVyKSB7XHJcbiAgICAgIHRoaXMuJG1lbnVJdGVtcy5vbignbW91c2VlbnRlci56Zi5kcm9wZG93bm1lbnUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyICRlbGVtID0gJCh0aGlzKSxcclxuICAgICAgICAgICAgaGFzU3ViID0gJGVsZW0uaGFzQ2xhc3MocGFyQ2xhc3MpO1xyXG5cclxuICAgICAgICBpZiAoaGFzU3ViKSB7XHJcbiAgICAgICAgICBjbGVhclRpbWVvdXQoJGVsZW0uZGF0YSgnX2RlbGF5JykpO1xyXG4gICAgICAgICAgJGVsZW0uZGF0YSgnX2RlbGF5Jywgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgX3RoaXMuX3Nob3coJGVsZW0uY2hpbGRyZW4oJy5pcy1kcm9wZG93bi1zdWJtZW51JykpO1xyXG4gICAgICAgICAgfSwgX3RoaXMub3B0aW9ucy5ob3ZlckRlbGF5KSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KS5vbignbW91c2VsZWF2ZS56Zi5kcm9wZG93bm1lbnUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyICRlbGVtID0gJCh0aGlzKSxcclxuICAgICAgICAgICAgaGFzU3ViID0gJGVsZW0uaGFzQ2xhc3MocGFyQ2xhc3MpO1xyXG4gICAgICAgIGlmIChoYXNTdWIgJiYgX3RoaXMub3B0aW9ucy5hdXRvY2xvc2UpIHtcclxuICAgICAgICAgIGlmICgkZWxlbS5hdHRyKCdkYXRhLWlzLWNsaWNrJykgPT09ICd0cnVlJyAmJiBfdGhpcy5vcHRpb25zLmNsaWNrT3BlbikgeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcbiAgICAgICAgICBjbGVhclRpbWVvdXQoJGVsZW0uZGF0YSgnX2RlbGF5JykpO1xyXG4gICAgICAgICAgJGVsZW0uZGF0YSgnX2RlbGF5Jywgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgX3RoaXMuX2hpZGUoJGVsZW0pO1xyXG4gICAgICAgICAgfSwgX3RoaXMub3B0aW9ucy5jbG9zaW5nVGltZSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLiRtZW51SXRlbXMub24oJ2tleWRvd24uemYuZHJvcGRvd25tZW51JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICB2YXIgJGVsZW1lbnQgPSAkKGUudGFyZ2V0KS5wYXJlbnRzVW50aWwoJ3VsJywgJ1tyb2xlPVwibWVudWl0ZW1cIl0nKSxcclxuICAgICAgICAgIGlzVGFiID0gX3RoaXMuJHRhYnMuaW5kZXgoJGVsZW1lbnQpID4gLTEsXHJcbiAgICAgICAgICAkZWxlbWVudHMgPSBpc1RhYiA/IF90aGlzLiR0YWJzIDogJGVsZW1lbnQuc2libGluZ3MoJ2xpJykuYWRkKCRlbGVtZW50KSxcclxuICAgICAgICAgICRwcmV2RWxlbWVudCxcclxuICAgICAgICAgICRuZXh0RWxlbWVudDtcclxuXHJcbiAgICAgICRlbGVtZW50cy5lYWNoKGZ1bmN0aW9uKGkpIHtcclxuICAgICAgICBpZiAoJCh0aGlzKS5pcygkZWxlbWVudCkpIHtcclxuICAgICAgICAgICRwcmV2RWxlbWVudCA9ICRlbGVtZW50cy5lcShpLTEpO1xyXG4gICAgICAgICAgJG5leHRFbGVtZW50ID0gJGVsZW1lbnRzLmVxKGkrMSk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHZhciBuZXh0U2libGluZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmICghJGVsZW1lbnQuaXMoJzpsYXN0LWNoaWxkJykpIHtcclxuICAgICAgICAgICRuZXh0RWxlbWVudC5jaGlsZHJlbignYTpmaXJzdCcpLmZvY3VzKCk7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBwcmV2U2libGluZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICRwcmV2RWxlbWVudC5jaGlsZHJlbignYTpmaXJzdCcpLmZvY3VzKCk7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB9LCBvcGVuU3ViID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyICRzdWIgPSAkZWxlbWVudC5jaGlsZHJlbigndWwuaXMtZHJvcGRvd24tc3VibWVudScpO1xyXG4gICAgICAgIGlmICgkc3ViLmxlbmd0aCkge1xyXG4gICAgICAgICAgX3RoaXMuX3Nob3coJHN1Yik7XHJcbiAgICAgICAgICAkZWxlbWVudC5maW5kKCdsaSA+IGE6Zmlyc3QnKS5mb2N1cygpO1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIH0gZWxzZSB7IHJldHVybjsgfVxyXG4gICAgICB9LCBjbG9zZVN1YiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIC8vaWYgKCRlbGVtZW50LmlzKCc6Zmlyc3QtY2hpbGQnKSkge1xyXG4gICAgICAgIHZhciBjbG9zZSA9ICRlbGVtZW50LnBhcmVudCgndWwnKS5wYXJlbnQoJ2xpJyk7XHJcbiAgICAgICAgY2xvc2UuY2hpbGRyZW4oJ2E6Zmlyc3QnKS5mb2N1cygpO1xyXG4gICAgICAgIF90aGlzLl9oaWRlKGNsb3NlKTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgLy99XHJcbiAgICAgIH07XHJcbiAgICAgIHZhciBmdW5jdGlvbnMgPSB7XHJcbiAgICAgICAgb3Blbjogb3BlblN1YixcclxuICAgICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBfdGhpcy5faGlkZShfdGhpcy4kZWxlbWVudCk7XHJcbiAgICAgICAgICBfdGhpcy4kbWVudUl0ZW1zLmZpbmQoJ2E6Zmlyc3QnKS5mb2N1cygpOyAvLyBmb2N1cyB0byBmaXJzdCBlbGVtZW50XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgaWYgKGlzVGFiKSB7XHJcbiAgICAgICAgaWYgKF90aGlzLl9pc1ZlcnRpY2FsKCkpIHsgLy8gdmVydGljYWwgbWVudVxyXG4gICAgICAgICAgaWYgKEZvdW5kYXRpb24ucnRsKCkpIHsgLy8gcmlnaHQgYWxpZ25lZFxyXG4gICAgICAgICAgICAkLmV4dGVuZChmdW5jdGlvbnMsIHtcclxuICAgICAgICAgICAgICBkb3duOiBuZXh0U2libGluZyxcclxuICAgICAgICAgICAgICB1cDogcHJldlNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgbmV4dDogY2xvc2VTdWIsXHJcbiAgICAgICAgICAgICAgcHJldmlvdXM6IG9wZW5TdWJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9IGVsc2UgeyAvLyBsZWZ0IGFsaWduZWRcclxuICAgICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XHJcbiAgICAgICAgICAgICAgZG93bjogbmV4dFNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgdXA6IHByZXZTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIG5leHQ6IG9wZW5TdWIsXHJcbiAgICAgICAgICAgICAgcHJldmlvdXM6IGNsb3NlU3ViXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7IC8vIGhvcml6b250YWwgbWVudVxyXG4gICAgICAgICAgaWYgKEZvdW5kYXRpb24ucnRsKCkpIHsgLy8gcmlnaHQgYWxpZ25lZFxyXG4gICAgICAgICAgICAkLmV4dGVuZChmdW5jdGlvbnMsIHtcclxuICAgICAgICAgICAgICBuZXh0OiBwcmV2U2libGluZyxcclxuICAgICAgICAgICAgICBwcmV2aW91czogbmV4dFNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgZG93bjogb3BlblN1YixcclxuICAgICAgICAgICAgICB1cDogY2xvc2VTdWJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9IGVsc2UgeyAvLyBsZWZ0IGFsaWduZWRcclxuICAgICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XHJcbiAgICAgICAgICAgICAgbmV4dDogbmV4dFNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgcHJldmlvdXM6IHByZXZTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIGRvd246IG9wZW5TdWIsXHJcbiAgICAgICAgICAgICAgdXA6IGNsb3NlU3ViXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHsgLy8gbm90IHRhYnMgLT4gb25lIHN1YlxyXG4gICAgICAgIGlmIChGb3VuZGF0aW9uLnJ0bCgpKSB7IC8vIHJpZ2h0IGFsaWduZWRcclxuICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xyXG4gICAgICAgICAgICBuZXh0OiBjbG9zZVN1YixcclxuICAgICAgICAgICAgcHJldmlvdXM6IG9wZW5TdWIsXHJcbiAgICAgICAgICAgIGRvd246IG5leHRTaWJsaW5nLFxyXG4gICAgICAgICAgICB1cDogcHJldlNpYmxpbmdcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7IC8vIGxlZnQgYWxpZ25lZFxyXG4gICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XHJcbiAgICAgICAgICAgIG5leHQ6IG9wZW5TdWIsXHJcbiAgICAgICAgICAgIHByZXZpb3VzOiBjbG9zZVN1YixcclxuICAgICAgICAgICAgZG93bjogbmV4dFNpYmxpbmcsXHJcbiAgICAgICAgICAgIHVwOiBwcmV2U2libGluZ1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdEcm9wZG93bk1lbnUnLCBmdW5jdGlvbnMpO1xyXG5cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhbiBldmVudCBoYW5kbGVyIHRvIHRoZSBib2R5IHRvIGNsb3NlIGFueSBkcm9wZG93bnMgb24gYSBjbGljay5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9hZGRCb2R5SGFuZGxlcigpIHtcclxuICAgIHZhciAkYm9keSA9ICQoZG9jdW1lbnQuYm9keSksXHJcbiAgICAgICAgX3RoaXMgPSB0aGlzO1xyXG4gICAgJGJvZHkub2ZmKCdtb3VzZXVwLnpmLmRyb3Bkb3dubWVudSB0b3VjaGVuZC56Zi5kcm9wZG93bm1lbnUnKVxyXG4gICAgICAgICAub24oJ21vdXNldXAuemYuZHJvcGRvd25tZW51IHRvdWNoZW5kLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICB2YXIgJGxpbmsgPSBfdGhpcy4kZWxlbWVudC5maW5kKGUudGFyZ2V0KTtcclxuICAgICAgICAgICBpZiAoJGxpbmsubGVuZ3RoKSB7IHJldHVybjsgfVxyXG5cclxuICAgICAgICAgICBfdGhpcy5faGlkZSgpO1xyXG4gICAgICAgICAgICRib2R5Lm9mZignbW91c2V1cC56Zi5kcm9wZG93bm1lbnUgdG91Y2hlbmQuemYuZHJvcGRvd25tZW51Jyk7XHJcbiAgICAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgYSBkcm9wZG93biBwYW5lLCBhbmQgY2hlY2tzIGZvciBjb2xsaXNpb25zIGZpcnN0LlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkc3ViIC0gdWwgZWxlbWVudCB0aGF0IGlzIGEgc3VibWVudSB0byBzaG93XHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAZmlyZXMgRHJvcGRvd25NZW51I3Nob3dcclxuICAgKi9cclxuICBfc2hvdygkc3ViKSB7XHJcbiAgICB2YXIgaWR4ID0gdGhpcy4kdGFicy5pbmRleCh0aGlzLiR0YWJzLmZpbHRlcihmdW5jdGlvbihpLCBlbCkge1xyXG4gICAgICByZXR1cm4gJChlbCkuZmluZCgkc3ViKS5sZW5ndGggPiAwO1xyXG4gICAgfSkpO1xyXG4gICAgdmFyICRzaWJzID0gJHN1Yi5wYXJlbnQoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50Jykuc2libGluZ3MoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50Jyk7XHJcbiAgICB0aGlzLl9oaWRlKCRzaWJzLCBpZHgpO1xyXG4gICAgJHN1Yi5jc3MoJ3Zpc2liaWxpdHknLCAnaGlkZGVuJykuYWRkQ2xhc3MoJ2pzLWRyb3Bkb3duLWFjdGl2ZScpXHJcbiAgICAgICAgLnBhcmVudCgnbGkuaXMtZHJvcGRvd24tc3VibWVudS1wYXJlbnQnKS5hZGRDbGFzcygnaXMtYWN0aXZlJyk7XHJcbiAgICB2YXIgY2xlYXIgPSBGb3VuZGF0aW9uLkJveC5JbU5vdFRvdWNoaW5nWW91KCRzdWIsIG51bGwsIHRydWUpO1xyXG4gICAgaWYgKCFjbGVhcikge1xyXG4gICAgICB2YXIgb2xkQ2xhc3MgPSB0aGlzLm9wdGlvbnMuYWxpZ25tZW50ID09PSAnbGVmdCcgPyAnLXJpZ2h0JyA6ICctbGVmdCcsXHJcbiAgICAgICAgICAkcGFyZW50TGkgPSAkc3ViLnBhcmVudCgnLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50Jyk7XHJcbiAgICAgICRwYXJlbnRMaS5yZW1vdmVDbGFzcyhgb3BlbnMke29sZENsYXNzfWApLmFkZENsYXNzKGBvcGVucy0ke3RoaXMub3B0aW9ucy5hbGlnbm1lbnR9YCk7XHJcbiAgICAgIGNsZWFyID0gRm91bmRhdGlvbi5Cb3guSW1Ob3RUb3VjaGluZ1lvdSgkc3ViLCBudWxsLCB0cnVlKTtcclxuICAgICAgaWYgKCFjbGVhcikge1xyXG4gICAgICAgICRwYXJlbnRMaS5yZW1vdmVDbGFzcyhgb3BlbnMtJHt0aGlzLm9wdGlvbnMuYWxpZ25tZW50fWApLmFkZENsYXNzKCdvcGVucy1pbm5lcicpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuY2hhbmdlZCA9IHRydWU7XHJcbiAgICB9XHJcbiAgICAkc3ViLmNzcygndmlzaWJpbGl0eScsICcnKTtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrKSB7IHRoaXMuX2FkZEJvZHlIYW5kbGVyKCk7IH1cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgbmV3IGRyb3Bkb3duIHBhbmUgaXMgdmlzaWJsZS5cclxuICAgICAqIEBldmVudCBEcm9wZG93bk1lbnUjc2hvd1xyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3Nob3cuemYuZHJvcGRvd25tZW51JywgWyRzdWJdKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhpZGVzIGEgc2luZ2xlLCBjdXJyZW50bHkgb3BlbiBkcm9wZG93biBwYW5lLCBpZiBwYXNzZWQgYSBwYXJhbWV0ZXIsIG90aGVyd2lzZSwgaGlkZXMgZXZlcnl0aGluZy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGVsZW0gLSBlbGVtZW50IHdpdGggYSBzdWJtZW51IHRvIGhpZGVcclxuICAgKiBAcGFyYW0ge051bWJlcn0gaWR4IC0gaW5kZXggb2YgdGhlICR0YWJzIGNvbGxlY3Rpb24gdG8gaGlkZVxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2hpZGUoJGVsZW0sIGlkeCkge1xyXG4gICAgdmFyICR0b0Nsb3NlO1xyXG4gICAgaWYgKCRlbGVtICYmICRlbGVtLmxlbmd0aCkge1xyXG4gICAgICAkdG9DbG9zZSA9ICRlbGVtO1xyXG4gICAgfSBlbHNlIGlmIChpZHggIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAkdG9DbG9zZSA9IHRoaXMuJHRhYnMubm90KGZ1bmN0aW9uKGksIGVsKSB7XHJcbiAgICAgICAgcmV0dXJuIGkgPT09IGlkeDtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgJHRvQ2xvc2UgPSB0aGlzLiRlbGVtZW50O1xyXG4gICAgfVxyXG4gICAgdmFyIHNvbWV0aGluZ1RvQ2xvc2UgPSAkdG9DbG9zZS5oYXNDbGFzcygnaXMtYWN0aXZlJykgfHwgJHRvQ2xvc2UuZmluZCgnLmlzLWFjdGl2ZScpLmxlbmd0aCA+IDA7XHJcblxyXG4gICAgaWYgKHNvbWV0aGluZ1RvQ2xvc2UpIHtcclxuICAgICAgJHRvQ2xvc2UuZmluZCgnbGkuaXMtYWN0aXZlJykuYWRkKCR0b0Nsb3NlKS5hdHRyKHtcclxuICAgICAgICAnZGF0YS1pcy1jbGljayc6IGZhbHNlXHJcbiAgICAgIH0pLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUnKTtcclxuXHJcbiAgICAgICR0b0Nsb3NlLmZpbmQoJ3VsLmpzLWRyb3Bkb3duLWFjdGl2ZScpLnJlbW92ZUNsYXNzKCdqcy1kcm9wZG93bi1hY3RpdmUnKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLmNoYW5nZWQgfHwgJHRvQ2xvc2UuZmluZCgnb3BlbnMtaW5uZXInKS5sZW5ndGgpIHtcclxuICAgICAgICB2YXIgb2xkQ2xhc3MgPSB0aGlzLm9wdGlvbnMuYWxpZ25tZW50ID09PSAnbGVmdCcgPyAncmlnaHQnIDogJ2xlZnQnO1xyXG4gICAgICAgICR0b0Nsb3NlLmZpbmQoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50JykuYWRkKCR0b0Nsb3NlKVxyXG4gICAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKGBvcGVucy1pbm5lciBvcGVucy0ke3RoaXMub3B0aW9ucy5hbGlnbm1lbnR9YClcclxuICAgICAgICAgICAgICAgIC5hZGRDbGFzcyhgb3BlbnMtJHtvbGRDbGFzc31gKTtcclxuICAgICAgICB0aGlzLmNoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogRmlyZXMgd2hlbiB0aGUgb3BlbiBtZW51cyBhcmUgY2xvc2VkLlxyXG4gICAgICAgKiBAZXZlbnQgRHJvcGRvd25NZW51I2hpZGVcclxuICAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignaGlkZS56Zi5kcm9wZG93bm1lbnUnLCBbJHRvQ2xvc2VdKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBwbHVnaW4uXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJG1lbnVJdGVtcy5vZmYoJy56Zi5kcm9wZG93bm1lbnUnKS5yZW1vdmVBdHRyKCdkYXRhLWlzLWNsaWNrJylcclxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2lzLXJpZ2h0LWFycm93IGlzLWxlZnQtYXJyb3cgaXMtZG93bi1hcnJvdyBvcGVucy1yaWdodCBvcGVucy1sZWZ0IG9wZW5zLWlubmVyJyk7XHJcbiAgICAkKGRvY3VtZW50LmJvZHkpLm9mZignLnpmLmRyb3Bkb3dubWVudScpO1xyXG4gICAgRm91bmRhdGlvbi5OZXN0LkJ1cm4odGhpcy4kZWxlbWVudCwgJ2Ryb3Bkb3duJyk7XHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVmYXVsdCBzZXR0aW5ncyBmb3IgcGx1Z2luXHJcbiAqL1xyXG5Ecm9wZG93bk1lbnUuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogRGlzYWxsb3dzIGhvdmVyIGV2ZW50cyBmcm9tIG9wZW5pbmcgc3VibWVudXNcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBkaXNhYmxlSG92ZXI6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IGEgc3VibWVudSB0byBhdXRvbWF0aWNhbGx5IGNsb3NlIG9uIGEgbW91c2VsZWF2ZSBldmVudCwgaWYgbm90IGNsaWNrZWQgb3Blbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGF1dG9jbG9zZTogdHJ1ZSxcclxuICAvKipcclxuICAgKiBBbW91bnQgb2YgdGltZSB0byBkZWxheSBvcGVuaW5nIGEgc3VibWVudSBvbiBob3ZlciBldmVudC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTBcclxuICAgKi9cclxuICBob3ZlckRlbGF5OiA1MCxcclxuICAvKipcclxuICAgKiBBbGxvdyBhIHN1Ym1lbnUgdG8gb3Blbi9yZW1haW4gb3BlbiBvbiBwYXJlbnQgY2xpY2sgZXZlbnQuIEFsbG93cyBjdXJzb3IgdG8gbW92ZSBhd2F5IGZyb20gbWVudS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsaWNrT3BlbjogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQW1vdW50IG9mIHRpbWUgdG8gZGVsYXkgY2xvc2luZyBhIHN1Ym1lbnUgb24gYSBtb3VzZWxlYXZlIGV2ZW50LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MDBcclxuICAgKi9cclxuXHJcbiAgY2xvc2luZ1RpbWU6IDUwMCxcclxuICAvKipcclxuICAgKiBQb3NpdGlvbiBvZiB0aGUgbWVudSByZWxhdGl2ZSB0byB3aGF0IGRpcmVjdGlvbiB0aGUgc3VibWVudXMgc2hvdWxkIG9wZW4uIEhhbmRsZWQgYnkgSlMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdsZWZ0J1xyXG4gICAqL1xyXG4gIGFsaWdubWVudDogJ2xlZnQnLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IGNsaWNrcyBvbiB0aGUgYm9keSB0byBjbG9zZSBhbnkgb3BlbiBzdWJtZW51cy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsb3NlT25DbGljazogdHJ1ZSxcclxuICAvKipcclxuICAgKiBBbGxvdyBjbGlja3Mgb24gbGVhZiBhbmNob3IgbGlua3MgdG8gY2xvc2UgYW55IG9wZW4gc3VibWVudXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbG9zZU9uQ2xpY2tJbnNpZGU6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byB2ZXJ0aWNhbCBvcmllbnRlZCBtZW51cywgRm91bmRhdGlvbiBkZWZhdWx0IGlzIGB2ZXJ0aWNhbGAuIFVwZGF0ZSB0aGlzIGlmIHVzaW5nIHlvdXIgb3duIGNsYXNzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAndmVydGljYWwnXHJcbiAgICovXHJcbiAgdmVydGljYWxDbGFzczogJ3ZlcnRpY2FsJyxcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHJpZ2h0LXNpZGUgb3JpZW50ZWQgbWVudXMsIEZvdW5kYXRpb24gZGVmYXVsdCBpcyBgYWxpZ24tcmlnaHRgLiBVcGRhdGUgdGhpcyBpZiB1c2luZyB5b3VyIG93biBjbGFzcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2FsaWduLXJpZ2h0J1xyXG4gICAqL1xyXG4gIHJpZ2h0Q2xhc3M6ICdhbGlnbi1yaWdodCcsXHJcbiAgLyoqXHJcbiAgICogQm9vbGVhbiB0byBmb3JjZSBvdmVyaWRlIHRoZSBjbGlja2luZyBvZiBsaW5rcyB0byBwZXJmb3JtIGRlZmF1bHQgYWN0aW9uLCBvbiBzZWNvbmQgdG91Y2ggZXZlbnQgZm9yIG1vYmlsZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBmb3JjZUZvbGxvdzogdHJ1ZVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oRHJvcGRvd25NZW51LCAnRHJvcGRvd25NZW51Jyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogRXF1YWxpemVyIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmVxdWFsaXplclxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50aW1lckFuZEltYWdlTG9hZGVyIGlmIGVxdWFsaXplciBjb250YWlucyBpbWFnZXNcclxuICovXHJcblxyXG5jbGFzcyBFcXVhbGl6ZXIge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgRXF1YWxpemVyLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBFcXVhbGl6ZXIjaW5pdFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBhZGQgdGhlIHRyaWdnZXIgdG8uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpe1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgID0gJC5leHRlbmQoe30sIEVxdWFsaXplci5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdFcXVhbGl6ZXInKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBFcXVhbGl6ZXIgcGx1Z2luIGFuZCBjYWxscyBmdW5jdGlvbnMgdG8gZ2V0IGVxdWFsaXplciBmdW5jdGlvbmluZyBvbiBsb2FkLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgZXFJZCA9IHRoaXMuJGVsZW1lbnQuYXR0cignZGF0YS1lcXVhbGl6ZXInKSB8fCAnJztcclxuICAgIHZhciAkd2F0Y2hlZCA9IHRoaXMuJGVsZW1lbnQuZmluZChgW2RhdGEtZXF1YWxpemVyLXdhdGNoPVwiJHtlcUlkfVwiXWApO1xyXG5cclxuICAgIHRoaXMuJHdhdGNoZWQgPSAkd2F0Y2hlZC5sZW5ndGggPyAkd2F0Y2hlZCA6IHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtZXF1YWxpemVyLXdhdGNoXScpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdkYXRhLXJlc2l6ZScsIChlcUlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ2VxJykpKTtcclxuXHR0aGlzLiRlbGVtZW50LmF0dHIoJ2RhdGEtbXV0YXRlJywgKGVxSWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnZXEnKSkpO1xyXG5cclxuICAgIHRoaXMuaGFzTmVzdGVkID0gdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1lcXVhbGl6ZXJdJykubGVuZ3RoID4gMDtcclxuICAgIHRoaXMuaXNOZXN0ZWQgPSB0aGlzLiRlbGVtZW50LnBhcmVudHNVbnRpbChkb2N1bWVudC5ib2R5LCAnW2RhdGEtZXF1YWxpemVyXScpLmxlbmd0aCA+IDA7XHJcbiAgICB0aGlzLmlzT24gPSBmYWxzZTtcclxuICAgIHRoaXMuX2JpbmRIYW5kbGVyID0ge1xyXG4gICAgICBvblJlc2l6ZU1lQm91bmQ6IHRoaXMuX29uUmVzaXplTWUuYmluZCh0aGlzKSxcclxuICAgICAgb25Qb3N0RXF1YWxpemVkQm91bmQ6IHRoaXMuX29uUG9zdEVxdWFsaXplZC5iaW5kKHRoaXMpXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBpbWdzID0gdGhpcy4kZWxlbWVudC5maW5kKCdpbWcnKTtcclxuICAgIHZhciB0b29TbWFsbDtcclxuICAgIGlmKHRoaXMub3B0aW9ucy5lcXVhbGl6ZU9uKXtcclxuICAgICAgdG9vU21hbGwgPSB0aGlzLl9jaGVja01RKCk7XHJcbiAgICAgICQod2luZG93KS5vbignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgdGhpcy5fY2hlY2tNUS5iaW5kKHRoaXMpKTtcclxuICAgIH1lbHNle1xyXG4gICAgICB0aGlzLl9ldmVudHMoKTtcclxuICAgIH1cclxuICAgIGlmKCh0b29TbWFsbCAhPT0gdW5kZWZpbmVkICYmIHRvb1NtYWxsID09PSBmYWxzZSkgfHwgdG9vU21hbGwgPT09IHVuZGVmaW5lZCl7XHJcbiAgICAgIGlmKGltZ3MubGVuZ3RoKXtcclxuICAgICAgICBGb3VuZGF0aW9uLm9uSW1hZ2VzTG9hZGVkKGltZ3MsIHRoaXMuX3JlZmxvdy5iaW5kKHRoaXMpKTtcclxuICAgICAgfWVsc2V7XHJcbiAgICAgICAgdGhpcy5fcmVmbG93KCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMgZXZlbnQgbGlzdGVuZXJzIGlmIHRoZSBicmVha3BvaW50IGlzIHRvbyBzbWFsbC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9wYXVzZUV2ZW50cygpIHtcclxuICAgIHRoaXMuaXNPbiA9IGZhbHNlO1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoe1xyXG4gICAgICAnLnpmLmVxdWFsaXplcic6IHRoaXMuX2JpbmRIYW5kbGVyLm9uUG9zdEVxdWFsaXplZEJvdW5kLFxyXG4gICAgICAncmVzaXplbWUuemYudHJpZ2dlcic6IHRoaXMuX2JpbmRIYW5kbGVyLm9uUmVzaXplTWVCb3VuZCxcclxuXHQgICdtdXRhdGVtZS56Zi50cmlnZ2VyJzogdGhpcy5fYmluZEhhbmRsZXIub25SZXNpemVNZUJvdW5kXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIGZ1bmN0aW9uIHRvIGhhbmRsZSAkZWxlbWVudHMgcmVzaXplbWUuemYudHJpZ2dlciwgd2l0aCBib3VuZCB0aGlzIG9uIF9iaW5kSGFuZGxlci5vblJlc2l6ZU1lQm91bmRcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9vblJlc2l6ZU1lKGUpIHtcclxuICAgIHRoaXMuX3JlZmxvdygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogZnVuY3Rpb24gdG8gaGFuZGxlICRlbGVtZW50cyBwb3N0ZXF1YWxpemVkLnpmLmVxdWFsaXplciwgd2l0aCBib3VuZCB0aGlzIG9uIF9iaW5kSGFuZGxlci5vblBvc3RFcXVhbGl6ZWRCb3VuZFxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX29uUG9zdEVxdWFsaXplZChlKSB7XHJcbiAgICBpZihlLnRhcmdldCAhPT0gdGhpcy4kZWxlbWVudFswXSl7IHRoaXMuX3JlZmxvdygpOyB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyBldmVudHMgZm9yIEVxdWFsaXplci5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy5fcGF1c2VFdmVudHMoKTtcclxuICAgIGlmKHRoaXMuaGFzTmVzdGVkKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbigncG9zdGVxdWFsaXplZC56Zi5lcXVhbGl6ZXInLCB0aGlzLl9iaW5kSGFuZGxlci5vblBvc3RFcXVhbGl6ZWRCb3VuZCk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbigncmVzaXplbWUuemYudHJpZ2dlcicsIHRoaXMuX2JpbmRIYW5kbGVyLm9uUmVzaXplTWVCb3VuZCk7XHJcblx0ICB0aGlzLiRlbGVtZW50Lm9uKCdtdXRhdGVtZS56Zi50cmlnZ2VyJywgdGhpcy5fYmluZEhhbmRsZXIub25SZXNpemVNZUJvdW5kKTtcclxuICAgIH1cclxuICAgIHRoaXMuaXNPbiA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgdGhlIGN1cnJlbnQgYnJlYWtwb2ludCB0byB0aGUgbWluaW11bSByZXF1aXJlZCBzaXplLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2NoZWNrTVEoKSB7XHJcbiAgICB2YXIgdG9vU21hbGwgPSAhRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmlzKHRoaXMub3B0aW9ucy5lcXVhbGl6ZU9uKTtcclxuICAgIGlmKHRvb1NtYWxsKXtcclxuICAgICAgaWYodGhpcy5pc09uKXtcclxuICAgICAgICB0aGlzLl9wYXVzZUV2ZW50cygpO1xyXG4gICAgICAgIHRoaXMuJHdhdGNoZWQuY3NzKCdoZWlnaHQnLCAnYXV0bycpO1xyXG4gICAgICB9XHJcbiAgICB9ZWxzZXtcclxuICAgICAgaWYoIXRoaXMuaXNPbil7XHJcbiAgICAgICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0b29TbWFsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgbm9vcCB2ZXJzaW9uIGZvciB0aGUgcGx1Z2luXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfa2lsbHN3aXRjaCgpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGxzIG5lY2Vzc2FyeSBmdW5jdGlvbnMgdG8gdXBkYXRlIEVxdWFsaXplciB1cG9uIERPTSBjaGFuZ2VcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9yZWZsb3coKSB7XHJcbiAgICBpZighdGhpcy5vcHRpb25zLmVxdWFsaXplT25TdGFjayl7XHJcbiAgICAgIGlmKHRoaXMuX2lzU3RhY2tlZCgpKXtcclxuICAgICAgICB0aGlzLiR3YXRjaGVkLmNzcygnaGVpZ2h0JywgJ2F1dG8nKTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZXF1YWxpemVCeVJvdykge1xyXG4gICAgICB0aGlzLmdldEhlaWdodHNCeVJvdyh0aGlzLmFwcGx5SGVpZ2h0QnlSb3cuYmluZCh0aGlzKSk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgdGhpcy5nZXRIZWlnaHRzKHRoaXMuYXBwbHlIZWlnaHQuYmluZCh0aGlzKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYW51YWxseSBkZXRlcm1pbmVzIGlmIHRoZSBmaXJzdCAyIGVsZW1lbnRzIGFyZSAqTk9UKiBzdGFja2VkLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2lzU3RhY2tlZCgpIHtcclxuICAgIGlmICghdGhpcy4kd2F0Y2hlZFswXSB8fCAhdGhpcy4kd2F0Y2hlZFsxXSkge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLiR3YXRjaGVkWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCAhPT0gdGhpcy4kd2F0Y2hlZFsxXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3A7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGaW5kcyB0aGUgb3V0ZXIgaGVpZ2h0cyBvZiBjaGlsZHJlbiBjb250YWluZWQgd2l0aGluIGFuIEVxdWFsaXplciBwYXJlbnQgYW5kIHJldHVybnMgdGhlbSBpbiBhbiBhcnJheVxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gQSBub24tb3B0aW9uYWwgY2FsbGJhY2sgdG8gcmV0dXJuIHRoZSBoZWlnaHRzIGFycmF5IHRvLlxyXG4gICAqIEByZXR1cm5zIHtBcnJheX0gaGVpZ2h0cyAtIEFuIGFycmF5IG9mIGhlaWdodHMgb2YgY2hpbGRyZW4gd2l0aGluIEVxdWFsaXplciBjb250YWluZXJcclxuICAgKi9cclxuICBnZXRIZWlnaHRzKGNiKSB7XHJcbiAgICB2YXIgaGVpZ2h0cyA9IFtdO1xyXG4gICAgZm9yKHZhciBpID0gMCwgbGVuID0gdGhpcy4kd2F0Y2hlZC5sZW5ndGg7IGkgPCBsZW47IGkrKyl7XHJcbiAgICAgIHRoaXMuJHdhdGNoZWRbaV0uc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xyXG4gICAgICBoZWlnaHRzLnB1c2godGhpcy4kd2F0Y2hlZFtpXS5vZmZzZXRIZWlnaHQpO1xyXG4gICAgfVxyXG4gICAgY2IoaGVpZ2h0cyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGaW5kcyB0aGUgb3V0ZXIgaGVpZ2h0cyBvZiBjaGlsZHJlbiBjb250YWluZWQgd2l0aGluIGFuIEVxdWFsaXplciBwYXJlbnQgYW5kIHJldHVybnMgdGhlbSBpbiBhbiBhcnJheVxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gQSBub24tb3B0aW9uYWwgY2FsbGJhY2sgdG8gcmV0dXJuIHRoZSBoZWlnaHRzIGFycmF5IHRvLlxyXG4gICAqIEByZXR1cm5zIHtBcnJheX0gZ3JvdXBzIC0gQW4gYXJyYXkgb2YgaGVpZ2h0cyBvZiBjaGlsZHJlbiB3aXRoaW4gRXF1YWxpemVyIGNvbnRhaW5lciBncm91cGVkIGJ5IHJvdyB3aXRoIGVsZW1lbnQsaGVpZ2h0IGFuZCBtYXggYXMgbGFzdCBjaGlsZFxyXG4gICAqL1xyXG4gIGdldEhlaWdodHNCeVJvdyhjYikge1xyXG4gICAgdmFyIGxhc3RFbFRvcE9mZnNldCA9ICh0aGlzLiR3YXRjaGVkLmxlbmd0aCA/IHRoaXMuJHdhdGNoZWQuZmlyc3QoKS5vZmZzZXQoKS50b3AgOiAwKSxcclxuICAgICAgICBncm91cHMgPSBbXSxcclxuICAgICAgICBncm91cCA9IDA7XHJcbiAgICAvL2dyb3VwIGJ5IFJvd1xyXG4gICAgZ3JvdXBzW2dyb3VwXSA9IFtdO1xyXG4gICAgZm9yKHZhciBpID0gMCwgbGVuID0gdGhpcy4kd2F0Y2hlZC5sZW5ndGg7IGkgPCBsZW47IGkrKyl7XHJcbiAgICAgIHRoaXMuJHdhdGNoZWRbaV0uc3R5bGUuaGVpZ2h0ID0gJ2F1dG8nO1xyXG4gICAgICAvL21heWJlIGNvdWxkIHVzZSB0aGlzLiR3YXRjaGVkW2ldLm9mZnNldFRvcFxyXG4gICAgICB2YXIgZWxPZmZzZXRUb3AgPSAkKHRoaXMuJHdhdGNoZWRbaV0pLm9mZnNldCgpLnRvcDtcclxuICAgICAgaWYgKGVsT2Zmc2V0VG9wIT1sYXN0RWxUb3BPZmZzZXQpIHtcclxuICAgICAgICBncm91cCsrO1xyXG4gICAgICAgIGdyb3Vwc1tncm91cF0gPSBbXTtcclxuICAgICAgICBsYXN0RWxUb3BPZmZzZXQ9ZWxPZmZzZXRUb3A7XHJcbiAgICAgIH1cclxuICAgICAgZ3JvdXBzW2dyb3VwXS5wdXNoKFt0aGlzLiR3YXRjaGVkW2ldLHRoaXMuJHdhdGNoZWRbaV0ub2Zmc2V0SGVpZ2h0XSk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaiA9IDAsIGxuID0gZ3JvdXBzLmxlbmd0aDsgaiA8IGxuOyBqKyspIHtcclxuICAgICAgdmFyIGhlaWdodHMgPSAkKGdyb3Vwc1tqXSkubWFwKGZ1bmN0aW9uKCl7IHJldHVybiB0aGlzWzFdOyB9KS5nZXQoKTtcclxuICAgICAgdmFyIG1heCAgICAgICAgID0gTWF0aC5tYXguYXBwbHkobnVsbCwgaGVpZ2h0cyk7XHJcbiAgICAgIGdyb3Vwc1tqXS5wdXNoKG1heCk7XHJcbiAgICB9XHJcbiAgICBjYihncm91cHMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hhbmdlcyB0aGUgQ1NTIGhlaWdodCBwcm9wZXJ0eSBvZiBlYWNoIGNoaWxkIGluIGFuIEVxdWFsaXplciBwYXJlbnQgdG8gbWF0Y2ggdGhlIHRhbGxlc3RcclxuICAgKiBAcGFyYW0ge2FycmF5fSBoZWlnaHRzIC0gQW4gYXJyYXkgb2YgaGVpZ2h0cyBvZiBjaGlsZHJlbiB3aXRoaW4gRXF1YWxpemVyIGNvbnRhaW5lclxyXG4gICAqIEBmaXJlcyBFcXVhbGl6ZXIjcHJlZXF1YWxpemVkXHJcbiAgICogQGZpcmVzIEVxdWFsaXplciNwb3N0ZXF1YWxpemVkXHJcbiAgICovXHJcbiAgYXBwbHlIZWlnaHQoaGVpZ2h0cykge1xyXG4gICAgdmFyIG1heCA9IE1hdGgubWF4LmFwcGx5KG51bGwsIGhlaWdodHMpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyBiZWZvcmUgdGhlIGhlaWdodHMgYXJlIGFwcGxpZWRcclxuICAgICAqIEBldmVudCBFcXVhbGl6ZXIjcHJlZXF1YWxpemVkXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncHJlZXF1YWxpemVkLnpmLmVxdWFsaXplcicpO1xyXG5cclxuICAgIHRoaXMuJHdhdGNoZWQuY3NzKCdoZWlnaHQnLCBtYXgpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgaGVpZ2h0cyBoYXZlIGJlZW4gYXBwbGllZFxyXG4gICAgICogQGV2ZW50IEVxdWFsaXplciNwb3N0ZXF1YWxpemVkXHJcbiAgICAgKi9cclxuICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3Bvc3RlcXVhbGl6ZWQuemYuZXF1YWxpemVyJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGFuZ2VzIHRoZSBDU1MgaGVpZ2h0IHByb3BlcnR5IG9mIGVhY2ggY2hpbGQgaW4gYW4gRXF1YWxpemVyIHBhcmVudCB0byBtYXRjaCB0aGUgdGFsbGVzdCBieSByb3dcclxuICAgKiBAcGFyYW0ge2FycmF5fSBncm91cHMgLSBBbiBhcnJheSBvZiBoZWlnaHRzIG9mIGNoaWxkcmVuIHdpdGhpbiBFcXVhbGl6ZXIgY29udGFpbmVyIGdyb3VwZWQgYnkgcm93IHdpdGggZWxlbWVudCxoZWlnaHQgYW5kIG1heCBhcyBsYXN0IGNoaWxkXHJcbiAgICogQGZpcmVzIEVxdWFsaXplciNwcmVlcXVhbGl6ZWRcclxuICAgKiBAZmlyZXMgRXF1YWxpemVyI3ByZWVxdWFsaXplZHJvd1xyXG4gICAqIEBmaXJlcyBFcXVhbGl6ZXIjcG9zdGVxdWFsaXplZHJvd1xyXG4gICAqIEBmaXJlcyBFcXVhbGl6ZXIjcG9zdGVxdWFsaXplZFxyXG4gICAqL1xyXG4gIGFwcGx5SGVpZ2h0QnlSb3coZ3JvdXBzKSB7XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIGJlZm9yZSB0aGUgaGVpZ2h0cyBhcmUgYXBwbGllZFxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3ByZWVxdWFsaXplZC56Zi5lcXVhbGl6ZXInKTtcclxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBncm91cHMubGVuZ3RoOyBpIDwgbGVuIDsgaSsrKSB7XHJcbiAgICAgIHZhciBncm91cHNJTGVuZ3RoID0gZ3JvdXBzW2ldLmxlbmd0aCxcclxuICAgICAgICAgIG1heCA9IGdyb3Vwc1tpXVtncm91cHNJTGVuZ3RoIC0gMV07XHJcbiAgICAgIGlmIChncm91cHNJTGVuZ3RoPD0yKSB7XHJcbiAgICAgICAgJChncm91cHNbaV1bMF1bMF0pLmNzcyh7J2hlaWdodCc6J2F1dG8nfSk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAgKiBGaXJlcyBiZWZvcmUgdGhlIGhlaWdodHMgcGVyIHJvdyBhcmUgYXBwbGllZFxyXG4gICAgICAgICogQGV2ZW50IEVxdWFsaXplciNwcmVlcXVhbGl6ZWRyb3dcclxuICAgICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3ByZWVxdWFsaXplZHJvdy56Zi5lcXVhbGl6ZXInKTtcclxuICAgICAgZm9yICh2YXIgaiA9IDAsIGxlbkogPSAoZ3JvdXBzSUxlbmd0aC0xKTsgaiA8IGxlbkogOyBqKyspIHtcclxuICAgICAgICAkKGdyb3Vwc1tpXVtqXVswXSkuY3NzKHsnaGVpZ2h0JzptYXh9KTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIGhlaWdodHMgcGVyIHJvdyBoYXZlIGJlZW4gYXBwbGllZFxyXG4gICAgICAgICogQGV2ZW50IEVxdWFsaXplciNwb3N0ZXF1YWxpemVkcm93XHJcbiAgICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdwb3N0ZXF1YWxpemVkcm93LnpmLmVxdWFsaXplcicpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBoZWlnaHRzIGhhdmUgYmVlbiBhcHBsaWVkXHJcbiAgICAgKi9cclxuICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3Bvc3RlcXVhbGl6ZWQuemYuZXF1YWxpemVyJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBFcXVhbGl6ZXIuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuX3BhdXNlRXZlbnRzKCk7XHJcbiAgICB0aGlzLiR3YXRjaGVkLmNzcygnaGVpZ2h0JywgJ2F1dG8nKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVmYXVsdCBzZXR0aW5ncyBmb3IgcGx1Z2luXHJcbiAqL1xyXG5FcXVhbGl6ZXIuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogRW5hYmxlIGhlaWdodCBlcXVhbGl6YXRpb24gd2hlbiBzdGFja2VkIG9uIHNtYWxsZXIgc2NyZWVucy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGVxdWFsaXplT25TdGFjazogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogRW5hYmxlIGhlaWdodCBlcXVhbGl6YXRpb24gcm93IGJ5IHJvdy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBlcXVhbGl6ZUJ5Um93OiBmYWxzZSxcclxuICAvKipcclxuICAgKiBTdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBtaW5pbXVtIGJyZWFrcG9pbnQgc2l6ZSB0aGUgcGx1Z2luIHNob3VsZCBlcXVhbGl6ZSBoZWlnaHRzIG9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnbWVkaXVtJ1xyXG4gICAqL1xyXG4gIGVxdWFsaXplT246ICcnXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihFcXVhbGl6ZXIsICdFcXVhbGl6ZXInKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBJbnRlcmNoYW5nZSBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5pbnRlcmNoYW5nZVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50aW1lckFuZEltYWdlTG9hZGVyXHJcbiAqL1xyXG5cclxuY2xhc3MgSW50ZXJjaGFuZ2Uge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgSW50ZXJjaGFuZ2UuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIEludGVyY2hhbmdlI2luaXRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gYWRkIHRoZSB0cmlnZ2VyIHRvLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBJbnRlcmNoYW5nZS5kZWZhdWx0cywgb3B0aW9ucyk7XHJcbiAgICB0aGlzLnJ1bGVzID0gW107XHJcbiAgICB0aGlzLmN1cnJlbnRQYXRoID0gJyc7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnSW50ZXJjaGFuZ2UnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBJbnRlcmNoYW5nZSBwbHVnaW4gYW5kIGNhbGxzIGZ1bmN0aW9ucyB0byBnZXQgaW50ZXJjaGFuZ2UgZnVuY3Rpb25pbmcgb24gbG9hZC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdGhpcy5fYWRkQnJlYWtwb2ludHMoKTtcclxuICAgIHRoaXMuX2dlbmVyYXRlUnVsZXMoKTtcclxuICAgIHRoaXMuX3JlZmxvdygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgZXZlbnRzIGZvciBJbnRlcmNoYW5nZS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICAkKHdpbmRvdykub24oJ3Jlc2l6ZS56Zi5pbnRlcmNoYW5nZScsIEZvdW5kYXRpb24udXRpbC50aHJvdHRsZSgoKSA9PiB7XHJcbiAgICAgIHRoaXMuX3JlZmxvdygpO1xyXG4gICAgfSwgNTApKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGxzIG5lY2Vzc2FyeSBmdW5jdGlvbnMgdG8gdXBkYXRlIEludGVyY2hhbmdlIHVwb24gRE9NIGNoYW5nZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3JlZmxvdygpIHtcclxuICAgIHZhciBtYXRjaDtcclxuXHJcbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggZWFjaCBydWxlLCBidXQgb25seSBzYXZlIHRoZSBsYXN0IG1hdGNoXHJcbiAgICBmb3IgKHZhciBpIGluIHRoaXMucnVsZXMpIHtcclxuICAgICAgaWYodGhpcy5ydWxlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xyXG4gICAgICAgIHZhciBydWxlID0gdGhpcy5ydWxlc1tpXTtcclxuICAgICAgICBpZiAod2luZG93Lm1hdGNoTWVkaWEocnVsZS5xdWVyeSkubWF0Y2hlcykge1xyXG4gICAgICAgICAgbWF0Y2ggPSBydWxlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChtYXRjaCkge1xyXG4gICAgICB0aGlzLnJlcGxhY2UobWF0Y2gucGF0aCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXRzIHRoZSBGb3VuZGF0aW9uIGJyZWFrcG9pbnRzIGFuZCBhZGRzIHRoZW0gdG8gdGhlIEludGVyY2hhbmdlLlNQRUNJQUxfUVVFUklFUyBvYmplY3QuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfYWRkQnJlYWtwb2ludHMoKSB7XHJcbiAgICBmb3IgKHZhciBpIGluIEZvdW5kYXRpb24uTWVkaWFRdWVyeS5xdWVyaWVzKSB7XHJcbiAgICAgIGlmIChGb3VuZGF0aW9uLk1lZGlhUXVlcnkucXVlcmllcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xyXG4gICAgICAgIHZhciBxdWVyeSA9IEZvdW5kYXRpb24uTWVkaWFRdWVyeS5xdWVyaWVzW2ldO1xyXG4gICAgICAgIEludGVyY2hhbmdlLlNQRUNJQUxfUVVFUklFU1txdWVyeS5uYW1lXSA9IHF1ZXJ5LnZhbHVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgdGhlIEludGVyY2hhbmdlIGVsZW1lbnQgZm9yIHRoZSBwcm92aWRlZCBtZWRpYSBxdWVyeSArIGNvbnRlbnQgcGFpcmluZ3NcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0aGF0IGlzIGFuIEludGVyY2hhbmdlIGluc3RhbmNlXHJcbiAgICogQHJldHVybnMge0FycmF5fSBzY2VuYXJpb3MgLSBBcnJheSBvZiBvYmplY3RzIHRoYXQgaGF2ZSAnbXEnIGFuZCAncGF0aCcga2V5cyB3aXRoIGNvcnJlc3BvbmRpbmcga2V5c1xyXG4gICAqL1xyXG4gIF9nZW5lcmF0ZVJ1bGVzKGVsZW1lbnQpIHtcclxuICAgIHZhciBydWxlc0xpc3QgPSBbXTtcclxuICAgIHZhciBydWxlcztcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnJ1bGVzKSB7XHJcbiAgICAgIHJ1bGVzID0gdGhpcy5vcHRpb25zLnJ1bGVzO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHJ1bGVzID0gdGhpcy4kZWxlbWVudC5kYXRhKCdpbnRlcmNoYW5nZScpLm1hdGNoKC9cXFsuKj9cXF0vZyk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSBpbiBydWxlcykge1xyXG4gICAgICBpZihydWxlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xyXG4gICAgICAgIHZhciBydWxlID0gcnVsZXNbaV0uc2xpY2UoMSwgLTEpLnNwbGl0KCcsICcpO1xyXG4gICAgICAgIHZhciBwYXRoID0gcnVsZS5zbGljZSgwLCAtMSkuam9pbignJyk7XHJcbiAgICAgICAgdmFyIHF1ZXJ5ID0gcnVsZVtydWxlLmxlbmd0aCAtIDFdO1xyXG5cclxuICAgICAgICBpZiAoSW50ZXJjaGFuZ2UuU1BFQ0lBTF9RVUVSSUVTW3F1ZXJ5XSkge1xyXG4gICAgICAgICAgcXVlcnkgPSBJbnRlcmNoYW5nZS5TUEVDSUFMX1FVRVJJRVNbcXVlcnldO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcnVsZXNMaXN0LnB1c2goe1xyXG4gICAgICAgICAgcGF0aDogcGF0aCxcclxuICAgICAgICAgIHF1ZXJ5OiBxdWVyeVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5ydWxlcyA9IHJ1bGVzTGlzdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB0aGUgYHNyY2AgcHJvcGVydHkgb2YgYW4gaW1hZ2UsIG9yIGNoYW5nZSB0aGUgSFRNTCBvZiBhIGNvbnRhaW5lciwgdG8gdGhlIHNwZWNpZmllZCBwYXRoLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIC0gUGF0aCB0byB0aGUgaW1hZ2Ugb3IgSFRNTCBwYXJ0aWFsLlxyXG4gICAqIEBmaXJlcyBJbnRlcmNoYW5nZSNyZXBsYWNlZFxyXG4gICAqL1xyXG4gIHJlcGxhY2UocGF0aCkge1xyXG4gICAgaWYgKHRoaXMuY3VycmVudFBhdGggPT09IHBhdGgpIHJldHVybjtcclxuXHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIHRyaWdnZXIgPSAncmVwbGFjZWQuemYuaW50ZXJjaGFuZ2UnO1xyXG5cclxuICAgIC8vIFJlcGxhY2luZyBpbWFnZXNcclxuICAgIGlmICh0aGlzLiRlbGVtZW50WzBdLm5vZGVOYW1lID09PSAnSU1HJykge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ3NyYycsIHBhdGgpLm9uKCdsb2FkJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMuY3VycmVudFBhdGggPSBwYXRoO1xyXG4gICAgICB9KVxyXG4gICAgICAudHJpZ2dlcih0cmlnZ2VyKTtcclxuICAgIH1cclxuICAgIC8vIFJlcGxhY2luZyBiYWNrZ3JvdW5kIGltYWdlc1xyXG4gICAgZWxzZSBpZiAocGF0aC5tYXRjaCgvXFwuKGdpZnxqcGd8anBlZ3xwbmd8c3ZnfHRpZmYpKFs/I10uKik/L2kpKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuY3NzKHsgJ2JhY2tncm91bmQtaW1hZ2UnOiAndXJsKCcrcGF0aCsnKScgfSlcclxuICAgICAgICAgIC50cmlnZ2VyKHRyaWdnZXIpO1xyXG4gICAgfVxyXG4gICAgLy8gUmVwbGFjaW5nIEhUTUxcclxuICAgIGVsc2Uge1xyXG4gICAgICAkLmdldChwYXRoLCBmdW5jdGlvbihyZXNwb25zZSkge1xyXG4gICAgICAgIF90aGlzLiRlbGVtZW50Lmh0bWwocmVzcG9uc2UpXHJcbiAgICAgICAgICAgICAudHJpZ2dlcih0cmlnZ2VyKTtcclxuICAgICAgICAkKHJlc3BvbnNlKS5mb3VuZGF0aW9uKCk7XHJcbiAgICAgICAgX3RoaXMuY3VycmVudFBhdGggPSBwYXRoO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gY29udGVudCBpbiBhbiBJbnRlcmNoYW5nZSBlbGVtZW50IGlzIGRvbmUgYmVpbmcgbG9hZGVkLlxyXG4gICAgICogQGV2ZW50IEludGVyY2hhbmdlI3JlcGxhY2VkXHJcbiAgICAgKi9cclxuICAgIC8vIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncmVwbGFjZWQuemYuaW50ZXJjaGFuZ2UnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIGludGVyY2hhbmdlLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICAvL1RPRE8gdGhpcy5cclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZWZhdWx0IHNldHRpbmdzIGZvciBwbHVnaW5cclxuICovXHJcbkludGVyY2hhbmdlLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIFJ1bGVzIHRvIGJlIGFwcGxpZWQgdG8gSW50ZXJjaGFuZ2UgZWxlbWVudHMuIFNldCB3aXRoIHRoZSBgZGF0YS1pbnRlcmNoYW5nZWAgYXJyYXkgbm90YXRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqL1xyXG4gIHJ1bGVzOiBudWxsXHJcbn07XHJcblxyXG5JbnRlcmNoYW5nZS5TUEVDSUFMX1FVRVJJRVMgPSB7XHJcbiAgJ2xhbmRzY2FwZSc6ICdzY3JlZW4gYW5kIChvcmllbnRhdGlvbjogbGFuZHNjYXBlKScsXHJcbiAgJ3BvcnRyYWl0JzogJ3NjcmVlbiBhbmQgKG9yaWVudGF0aW9uOiBwb3J0cmFpdCknLFxyXG4gICdyZXRpbmEnOiAnb25seSBzY3JlZW4gYW5kICgtd2Via2l0LW1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDIpLCBvbmx5IHNjcmVlbiBhbmQgKG1pbi0tbW96LWRldmljZS1waXhlbC1yYXRpbzogMiksIG9ubHkgc2NyZWVuIGFuZCAoLW8tbWluLWRldmljZS1waXhlbC1yYXRpbzogMi8xKSwgb25seSBzY3JlZW4gYW5kIChtaW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAyKSwgb25seSBzY3JlZW4gYW5kIChtaW4tcmVzb2x1dGlvbjogMTkyZHBpKSwgb25seSBzY3JlZW4gYW5kIChtaW4tcmVzb2x1dGlvbjogMmRwcHgpJ1xyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oSW50ZXJjaGFuZ2UsICdJbnRlcmNoYW5nZScpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIE1hZ2VsbGFuIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLm1hZ2VsbGFuXHJcbiAqL1xyXG5cclxuY2xhc3MgTWFnZWxsYW4ge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgTWFnZWxsYW4uXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIE1hZ2VsbGFuI2luaXRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gYWRkIHRoZSB0cmlnZ2VyIHRvLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyAgPSAkLmV4dGVuZCh7fSwgTWFnZWxsYW4uZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgICB0aGlzLmNhbGNQb2ludHMoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdNYWdlbGxhbicpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIE1hZ2VsbGFuIHBsdWdpbiBhbmQgY2FsbHMgZnVuY3Rpb25zIHRvIGdldCBlcXVhbGl6ZXIgZnVuY3Rpb25pbmcgb24gbG9hZC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIGlkID0gdGhpcy4kZWxlbWVudFswXS5pZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdtYWdlbGxhbicpO1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMuJHRhcmdldHMgPSAkKCdbZGF0YS1tYWdlbGxhbi10YXJnZXRdJyk7XHJcbiAgICB0aGlzLiRsaW5rcyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnYScpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKHtcclxuICAgICAgJ2RhdGEtcmVzaXplJzogaWQsXHJcbiAgICAgICdkYXRhLXNjcm9sbCc6IGlkLFxyXG4gICAgICAnaWQnOiBpZFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLiRhY3RpdmUgPSAkKCk7XHJcbiAgICB0aGlzLnNjcm9sbFBvcyA9IHBhcnNlSW50KHdpbmRvdy5wYWdlWU9mZnNldCwgMTApO1xyXG5cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsY3VsYXRlcyBhbiBhcnJheSBvZiBwaXhlbCB2YWx1ZXMgdGhhdCBhcmUgdGhlIGRlbWFyY2F0aW9uIGxpbmVzIGJldHdlZW4gbG9jYXRpb25zIG9uIHRoZSBwYWdlLlxyXG4gICAqIENhbiBiZSBpbnZva2VkIGlmIG5ldyBlbGVtZW50cyBhcmUgYWRkZWQgb3IgdGhlIHNpemUgb2YgYSBsb2NhdGlvbiBjaGFuZ2VzLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGNhbGNQb2ludHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIGJvZHkgPSBkb2N1bWVudC5ib2R5LFxyXG4gICAgICAgIGh0bWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XHJcblxyXG4gICAgdGhpcy5wb2ludHMgPSBbXTtcclxuICAgIHRoaXMud2luSGVpZ2h0ID0gTWF0aC5yb3VuZChNYXRoLm1heCh3aW5kb3cuaW5uZXJIZWlnaHQsIGh0bWwuY2xpZW50SGVpZ2h0KSk7XHJcbiAgICB0aGlzLmRvY0hlaWdodCA9IE1hdGgucm91bmQoTWF0aC5tYXgoYm9keS5zY3JvbGxIZWlnaHQsIGJvZHkub2Zmc2V0SGVpZ2h0LCBodG1sLmNsaWVudEhlaWdodCwgaHRtbC5zY3JvbGxIZWlnaHQsIGh0bWwub2Zmc2V0SGVpZ2h0KSk7XHJcblxyXG4gICAgdGhpcy4kdGFyZ2V0cy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciAkdGFyID0gJCh0aGlzKSxcclxuICAgICAgICAgIHB0ID0gTWF0aC5yb3VuZCgkdGFyLm9mZnNldCgpLnRvcCAtIF90aGlzLm9wdGlvbnMudGhyZXNob2xkKTtcclxuICAgICAgJHRhci50YXJnZXRQb2ludCA9IHB0O1xyXG4gICAgICBfdGhpcy5wb2ludHMucHVzaChwdCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIGV2ZW50cyBmb3IgTWFnZWxsYW4uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICAkYm9keSA9ICQoJ2h0bWwsIGJvZHknKSxcclxuICAgICAgICBvcHRzID0ge1xyXG4gICAgICAgICAgZHVyYXRpb246IF90aGlzLm9wdGlvbnMuYW5pbWF0aW9uRHVyYXRpb24sXHJcbiAgICAgICAgICBlYXNpbmc6ICAgX3RoaXMub3B0aW9ucy5hbmltYXRpb25FYXNpbmdcclxuICAgICAgICB9O1xyXG4gICAgJCh3aW5kb3cpLm9uZSgnbG9hZCcsIGZ1bmN0aW9uKCl7XHJcbiAgICAgIGlmKF90aGlzLm9wdGlvbnMuZGVlcExpbmtpbmcpe1xyXG4gICAgICAgIGlmKGxvY2F0aW9uLmhhc2gpe1xyXG4gICAgICAgICAgX3RoaXMuc2Nyb2xsVG9Mb2MobG9jYXRpb24uaGFzaCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIF90aGlzLmNhbGNQb2ludHMoKTtcclxuICAgICAgX3RoaXMuX3VwZGF0ZUFjdGl2ZSgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vbih7XHJcbiAgICAgICdyZXNpemVtZS56Zi50cmlnZ2VyJzogdGhpcy5yZWZsb3cuYmluZCh0aGlzKSxcclxuICAgICAgJ3Njcm9sbG1lLnpmLnRyaWdnZXInOiB0aGlzLl91cGRhdGVBY3RpdmUuYmluZCh0aGlzKVxyXG4gICAgfSkub24oJ2NsaWNrLnpmLm1hZ2VsbGFuJywgJ2FbaHJlZl49XCIjXCJdJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICB2YXIgYXJyaXZhbCAgID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ2hyZWYnKTtcclxuICAgICAgICBfdGhpcy5zY3JvbGxUb0xvYyhhcnJpdmFsKTtcclxuICAgICAgfSk7XHJcbiAgICAkKHdpbmRvdykub24oJ3BvcHN0YXRlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZihfdGhpcy5vcHRpb25zLmRlZXBMaW5raW5nKSB7XHJcbiAgICAgICAgX3RoaXMuc2Nyb2xsVG9Mb2Mod2luZG93LmxvY2F0aW9uLmhhc2gpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZ1bmN0aW9uIHRvIHNjcm9sbCB0byBhIGdpdmVuIGxvY2F0aW9uIG9uIHRoZSBwYWdlLlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBsb2MgLSBhIHByb3Blcmx5IGZvcm1hdHRlZCBqUXVlcnkgaWQgc2VsZWN0b3IuIEV4YW1wbGU6ICcjZm9vJ1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHNjcm9sbFRvTG9jKGxvYykge1xyXG4gICAgLy8gRG8gbm90aGluZyBpZiB0YXJnZXQgZG9lcyBub3QgZXhpc3QgdG8gcHJldmVudCBlcnJvcnNcclxuICAgIGlmICghJChsb2MpLmxlbmd0aCkge3JldHVybiBmYWxzZTt9XHJcbiAgICB0aGlzLl9pblRyYW5zaXRpb24gPSB0cnVlO1xyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICBzY3JvbGxQb3MgPSBNYXRoLnJvdW5kKCQobG9jKS5vZmZzZXQoKS50b3AgLSB0aGlzLm9wdGlvbnMudGhyZXNob2xkIC8gMiAtIHRoaXMub3B0aW9ucy5iYXJPZmZzZXQpO1xyXG5cclxuICAgICQoJ2h0bWwsIGJvZHknKS5zdG9wKHRydWUpLmFuaW1hdGUoXHJcbiAgICAgIHsgc2Nyb2xsVG9wOiBzY3JvbGxQb3MgfSxcclxuICAgICAgdGhpcy5vcHRpb25zLmFuaW1hdGlvbkR1cmF0aW9uLFxyXG4gICAgICB0aGlzLm9wdGlvbnMuYW5pbWF0aW9uRWFzaW5nLFxyXG4gICAgICBmdW5jdGlvbigpIHtfdGhpcy5faW5UcmFuc2l0aW9uID0gZmFsc2U7IF90aGlzLl91cGRhdGVBY3RpdmUoKX1cclxuICAgICk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxscyBuZWNlc3NhcnkgZnVuY3Rpb25zIHRvIHVwZGF0ZSBNYWdlbGxhbiB1cG9uIERPTSBjaGFuZ2VcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICByZWZsb3coKSB7XHJcbiAgICB0aGlzLmNhbGNQb2ludHMoKTtcclxuICAgIHRoaXMuX3VwZGF0ZUFjdGl2ZSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlcyB0aGUgdmlzaWJpbGl0eSBvZiBhbiBhY3RpdmUgbG9jYXRpb24gbGluaywgYW5kIHVwZGF0ZXMgdGhlIHVybCBoYXNoIGZvciB0aGUgcGFnZSwgaWYgZGVlcExpbmtpbmcgZW5hYmxlZC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBNYWdlbGxhbiN1cGRhdGVcclxuICAgKi9cclxuICBfdXBkYXRlQWN0aXZlKC8qZXZ0LCBlbGVtLCBzY3JvbGxQb3MqLykge1xyXG4gICAgaWYodGhpcy5faW5UcmFuc2l0aW9uKSB7cmV0dXJuO31cclxuICAgIHZhciB3aW5Qb3MgPSAvKnNjcm9sbFBvcyB8fCovIHBhcnNlSW50KHdpbmRvdy5wYWdlWU9mZnNldCwgMTApLFxyXG4gICAgICAgIGN1cklkeDtcclxuXHJcbiAgICBpZih3aW5Qb3MgKyB0aGlzLndpbkhlaWdodCA9PT0gdGhpcy5kb2NIZWlnaHQpeyBjdXJJZHggPSB0aGlzLnBvaW50cy5sZW5ndGggLSAxOyB9XHJcbiAgICBlbHNlIGlmKHdpblBvcyA8IHRoaXMucG9pbnRzWzBdKXsgY3VySWR4ID0gdW5kZWZpbmVkOyB9XHJcbiAgICBlbHNle1xyXG4gICAgICB2YXIgaXNEb3duID0gdGhpcy5zY3JvbGxQb3MgPCB3aW5Qb3MsXHJcbiAgICAgICAgICBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgICBjdXJWaXNpYmxlID0gdGhpcy5wb2ludHMuZmlsdGVyKGZ1bmN0aW9uKHAsIGkpe1xyXG4gICAgICAgICAgICByZXR1cm4gaXNEb3duID8gcCAtIF90aGlzLm9wdGlvbnMuYmFyT2Zmc2V0IDw9IHdpblBvcyA6IHAgLSBfdGhpcy5vcHRpb25zLmJhck9mZnNldCAtIF90aGlzLm9wdGlvbnMudGhyZXNob2xkIDw9IHdpblBvcztcclxuICAgICAgICAgIH0pO1xyXG4gICAgICBjdXJJZHggPSBjdXJWaXNpYmxlLmxlbmd0aCA/IGN1clZpc2libGUubGVuZ3RoIC0gMSA6IDA7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kYWN0aXZlLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5hY3RpdmVDbGFzcyk7XHJcbiAgICB0aGlzLiRhY3RpdmUgPSB0aGlzLiRsaW5rcy5maWx0ZXIoJ1tocmVmPVwiIycgKyB0aGlzLiR0YXJnZXRzLmVxKGN1cklkeCkuZGF0YSgnbWFnZWxsYW4tdGFyZ2V0JykgKyAnXCJdJykuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmFjdGl2ZUNsYXNzKTtcclxuXHJcbiAgICBpZih0aGlzLm9wdGlvbnMuZGVlcExpbmtpbmcpe1xyXG4gICAgICB2YXIgaGFzaCA9IFwiXCI7XHJcbiAgICAgIGlmKGN1cklkeCAhPSB1bmRlZmluZWQpe1xyXG4gICAgICAgIGhhc2ggPSB0aGlzLiRhY3RpdmVbMF0uZ2V0QXR0cmlidXRlKCdocmVmJyk7XHJcbiAgICAgIH1cclxuICAgICAgaWYoaGFzaCAhPT0gd2luZG93LmxvY2F0aW9uLmhhc2gpIHtcclxuICAgICAgICBpZih3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUpe1xyXG4gICAgICAgICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKG51bGwsIG51bGwsIGhhc2gpO1xyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSBoYXNoO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc2Nyb2xsUG9zID0gd2luUG9zO1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIG1hZ2VsbGFuIGlzIGZpbmlzaGVkIHVwZGF0aW5nIHRvIHRoZSBuZXcgYWN0aXZlIGVsZW1lbnQuXHJcbiAgICAgKiBAZXZlbnQgTWFnZWxsYW4jdXBkYXRlXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigndXBkYXRlLnpmLm1hZ2VsbGFuJywgW3RoaXMuJGFjdGl2ZV0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgTWFnZWxsYW4gYW5kIHJlc2V0cyB0aGUgdXJsIG9mIHRoZSB3aW5kb3cuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYudHJpZ2dlciAuemYubWFnZWxsYW4nKVxyXG4gICAgICAgIC5maW5kKGAuJHt0aGlzLm9wdGlvbnMuYWN0aXZlQ2xhc3N9YCkucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmFjdGl2ZUNsYXNzKTtcclxuXHJcbiAgICBpZih0aGlzLm9wdGlvbnMuZGVlcExpbmtpbmcpe1xyXG4gICAgICB2YXIgaGFzaCA9IHRoaXMuJGFjdGl2ZVswXS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKTtcclxuICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2gucmVwbGFjZShoYXNoLCAnJyk7XHJcbiAgICB9XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgc2V0dGluZ3MgZm9yIHBsdWdpblxyXG4gKi9cclxuTWFnZWxsYW4uZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogQW1vdW50IG9mIHRpbWUsIGluIG1zLCB0aGUgYW5pbWF0ZWQgc2Nyb2xsaW5nIHNob3VsZCB0YWtlIGJldHdlZW4gbG9jYXRpb25zLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MDBcclxuICAgKi9cclxuICBhbmltYXRpb25EdXJhdGlvbjogNTAwLFxyXG4gIC8qKlxyXG4gICAqIEFuaW1hdGlvbiBzdHlsZSB0byB1c2Ugd2hlbiBzY3JvbGxpbmcgYmV0d2VlbiBsb2NhdGlvbnMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdlYXNlLWluLW91dCdcclxuICAgKi9cclxuICBhbmltYXRpb25FYXNpbmc6ICdsaW5lYXInLFxyXG4gIC8qKlxyXG4gICAqIE51bWJlciBvZiBwaXhlbHMgdG8gdXNlIGFzIGEgbWFya2VyIGZvciBsb2NhdGlvbiBjaGFuZ2VzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MFxyXG4gICAqL1xyXG4gIHRocmVzaG9sZDogNTAsXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byB0aGUgYWN0aXZlIGxvY2F0aW9ucyBsaW5rIG9uIHRoZSBtYWdlbGxhbiBjb250YWluZXIuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdhY3RpdmUnXHJcbiAgICovXHJcbiAgYWN0aXZlQ2xhc3M6ICdhY3RpdmUnLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgc2NyaXB0IHRvIG1hbmlwdWxhdGUgdGhlIHVybCBvZiB0aGUgY3VycmVudCBwYWdlLCBhbmQgaWYgc3VwcG9ydGVkLCBhbHRlciB0aGUgaGlzdG9yeS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGRlZXBMaW5raW5nOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBOdW1iZXIgb2YgcGl4ZWxzIHRvIG9mZnNldCB0aGUgc2Nyb2xsIG9mIHRoZSBwYWdlIG9uIGl0ZW0gY2xpY2sgaWYgdXNpbmcgYSBzdGlja3kgbmF2IGJhci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMjVcclxuICAgKi9cclxuICBiYXJPZmZzZXQ6IDBcclxufVxyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oTWFnZWxsYW4sICdNYWdlbGxhbicpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIE9mZkNhbnZhcyBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5vZmZjYW52YXNcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb25cclxuICovXHJcblxyXG5jbGFzcyBPZmZDYW52YXMge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYW4gb2ZmLWNhbnZhcyB3cmFwcGVyLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBPZmZDYW52YXMjaW5pdFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBpbml0aWFsaXplLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBPZmZDYW52YXMuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuICAgIHRoaXMuJGxhc3RUcmlnZ2VyID0gJCgpO1xyXG4gICAgdGhpcy4kdHJpZ2dlcnMgPSAkKCk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnT2ZmQ2FudmFzJylcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ09mZkNhbnZhcycsIHtcclxuICAgICAgJ0VTQ0FQRSc6ICdjbG9zZSdcclxuICAgIH0pO1xyXG5cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBvZmYtY2FudmFzIHdyYXBwZXIgYnkgYWRkaW5nIHRoZSBleGl0IG92ZXJsYXkgKGlmIG5lZWRlZCkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBpZCA9IHRoaXMuJGVsZW1lbnQuYXR0cignaWQnKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKGBpcy10cmFuc2l0aW9uLSR7dGhpcy5vcHRpb25zLnRyYW5zaXRpb259YCk7XHJcblxyXG4gICAgLy8gRmluZCB0cmlnZ2VycyB0aGF0IGFmZmVjdCB0aGlzIGVsZW1lbnQgYW5kIGFkZCBhcmlhLWV4cGFuZGVkIHRvIHRoZW1cclxuICAgIHRoaXMuJHRyaWdnZXJzID0gJChkb2N1bWVudClcclxuICAgICAgLmZpbmQoJ1tkYXRhLW9wZW49XCInK2lkKydcIl0sIFtkYXRhLWNsb3NlPVwiJytpZCsnXCJdLCBbZGF0YS10b2dnbGU9XCInK2lkKydcIl0nKVxyXG4gICAgICAuYXR0cignYXJpYS1leHBhbmRlZCcsICdmYWxzZScpXHJcbiAgICAgIC5hdHRyKCdhcmlhLWNvbnRyb2xzJywgaWQpO1xyXG5cclxuICAgIC8vIEFkZCBhbiBvdmVybGF5IG92ZXIgdGhlIGNvbnRlbnQgaWYgbmVjZXNzYXJ5XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbnRlbnRPdmVybGF5ID09PSB0cnVlKSB7XHJcbiAgICAgIHZhciBvdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgIHZhciBvdmVybGF5UG9zaXRpb24gPSAkKHRoaXMuJGVsZW1lbnQpLmNzcyhcInBvc2l0aW9uXCIpID09PSAnZml4ZWQnID8gJ2lzLW92ZXJsYXktZml4ZWQnIDogJ2lzLW92ZXJsYXktYWJzb2x1dGUnO1xyXG4gICAgICBvdmVybGF5LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnanMtb2ZmLWNhbnZhcy1vdmVybGF5ICcgKyBvdmVybGF5UG9zaXRpb24pO1xyXG4gICAgICB0aGlzLiRvdmVybGF5ID0gJChvdmVybGF5KTtcclxuICAgICAgaWYob3ZlcmxheVBvc2l0aW9uID09PSAnaXMtb3ZlcmxheS1maXhlZCcpIHtcclxuICAgICAgICAkKCdib2R5JykuYXBwZW5kKHRoaXMuJG92ZXJsYXkpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuJGVsZW1lbnQuc2libGluZ3MoJ1tkYXRhLW9mZi1jYW52YXMtY29udGVudF0nKS5hcHBlbmQodGhpcy4kb3ZlcmxheSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm9wdGlvbnMuaXNSZXZlYWxlZCA9IHRoaXMub3B0aW9ucy5pc1JldmVhbGVkIHx8IG5ldyBSZWdFeHAodGhpcy5vcHRpb25zLnJldmVhbENsYXNzLCAnZycpLnRlc3QodGhpcy4kZWxlbWVudFswXS5jbGFzc05hbWUpO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuaXNSZXZlYWxlZCA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLm9wdGlvbnMucmV2ZWFsT24gPSB0aGlzLm9wdGlvbnMucmV2ZWFsT24gfHwgdGhpcy4kZWxlbWVudFswXS5jbGFzc05hbWUubWF0Y2goLyhyZXZlYWwtZm9yLW1lZGl1bXxyZXZlYWwtZm9yLWxhcmdlKS9nKVswXS5zcGxpdCgnLScpWzJdO1xyXG4gICAgICB0aGlzLl9zZXRNUUNoZWNrZXIoKTtcclxuICAgIH1cclxuICAgIGlmICghdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1lID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltZSA9IHBhcnNlRmxvYXQod2luZG93LmdldENvbXB1dGVkU3R5bGUoJCgnW2RhdGEtb2ZmLWNhbnZhc10nKVswXSkudHJhbnNpdGlvbkR1cmF0aW9uKSAqIDEwMDA7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIHRvIHRoZSBvZmYtY2FudmFzIHdyYXBwZXIgYW5kIHRoZSBleGl0IG92ZXJsYXkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi50cmlnZ2VyIC56Zi5vZmZjYW52YXMnKS5vbih7XHJcbiAgICAgICdvcGVuLnpmLnRyaWdnZXInOiB0aGlzLm9wZW4uYmluZCh0aGlzKSxcclxuICAgICAgJ2Nsb3NlLnpmLnRyaWdnZXInOiB0aGlzLmNsb3NlLmJpbmQodGhpcyksXHJcbiAgICAgICd0b2dnbGUuemYudHJpZ2dlcic6IHRoaXMudG9nZ2xlLmJpbmQodGhpcyksXHJcbiAgICAgICdrZXlkb3duLnpmLm9mZmNhbnZhcyc6IHRoaXMuX2hhbmRsZUtleWJvYXJkLmJpbmQodGhpcylcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrID09PSB0cnVlKSB7XHJcbiAgICAgIHZhciAkdGFyZ2V0ID0gdGhpcy5vcHRpb25zLmNvbnRlbnRPdmVybGF5ID8gdGhpcy4kb3ZlcmxheSA6ICQoJ1tkYXRhLW9mZi1jYW52YXMtY29udGVudF0nKTtcclxuICAgICAgJHRhcmdldC5vbih7J2NsaWNrLnpmLm9mZmNhbnZhcyc6IHRoaXMuY2xvc2UuYmluZCh0aGlzKX0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXBwbGllcyBldmVudCBsaXN0ZW5lciBmb3IgZWxlbWVudHMgdGhhdCB3aWxsIHJldmVhbCBhdCBjZXJ0YWluIGJyZWFrcG9pbnRzLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3NldE1RQ2hlY2tlcigpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgJCh3aW5kb3cpLm9uKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKEZvdW5kYXRpb24uTWVkaWFRdWVyeS5hdExlYXN0KF90aGlzLm9wdGlvbnMucmV2ZWFsT24pKSB7XHJcbiAgICAgICAgX3RoaXMucmV2ZWFsKHRydWUpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIF90aGlzLnJldmVhbChmYWxzZSk7XHJcbiAgICAgIH1cclxuICAgIH0pLm9uZSgnbG9hZC56Zi5vZmZjYW52YXMnLCBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKEZvdW5kYXRpb24uTWVkaWFRdWVyeS5hdExlYXN0KF90aGlzLm9wdGlvbnMucmV2ZWFsT24pKSB7XHJcbiAgICAgICAgX3RoaXMucmV2ZWFsKHRydWUpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZXMgdGhlIHJldmVhbGluZy9oaWRpbmcgdGhlIG9mZi1jYW52YXMgYXQgYnJlYWtwb2ludHMsIG5vdCB0aGUgc2FtZSBhcyBvcGVuLlxyXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNSZXZlYWxlZCAtIHRydWUgaWYgZWxlbWVudCBzaG91bGQgYmUgcmV2ZWFsZWQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgcmV2ZWFsKGlzUmV2ZWFsZWQpIHtcclxuICAgIHZhciAkY2xvc2VyID0gdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1jbG9zZV0nKTtcclxuICAgIGlmIChpc1JldmVhbGVkKSB7XHJcbiAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgICAgdGhpcy5pc1JldmVhbGVkID0gdHJ1ZTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWhpZGRlbicsICdmYWxzZScpO1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9mZignb3Blbi56Zi50cmlnZ2VyIHRvZ2dsZS56Zi50cmlnZ2VyJyk7XHJcbiAgICAgIGlmICgkY2xvc2VyLmxlbmd0aCkgeyAkY2xvc2VyLmhpZGUoKTsgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5pc1JldmVhbGVkID0gZmFsc2U7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9uKHtcclxuICAgICAgICAnb3Blbi56Zi50cmlnZ2VyJzogdGhpcy5vcGVuLmJpbmQodGhpcyksXHJcbiAgICAgICAgJ3RvZ2dsZS56Zi50cmlnZ2VyJzogdGhpcy50b2dnbGUuYmluZCh0aGlzKVxyXG4gICAgICB9KTtcclxuICAgICAgaWYgKCRjbG9zZXIubGVuZ3RoKSB7XHJcbiAgICAgICAgJGNsb3Nlci5zaG93KCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0b3BzIHNjcm9sbGluZyBvZiB0aGUgYm9keSB3aGVuIG9mZmNhbnZhcyBpcyBvcGVuIG9uIG1vYmlsZSBTYWZhcmkgYW5kIG90aGVyIHRyb3VibGVzb21lIGJyb3dzZXJzLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3N0b3BTY3JvbGxpbmcoZXZlbnQpIHtcclxuICBcdHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIHRoZSBvZmYtY2FudmFzIG1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50IC0gRXZlbnQgb2JqZWN0IHBhc3NlZCBmcm9tIGxpc3RlbmVyLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSB0cmlnZ2VyIC0gZWxlbWVudCB0aGF0IHRyaWdnZXJlZCB0aGUgb2ZmLWNhbnZhcyB0byBvcGVuLlxyXG4gICAqIEBmaXJlcyBPZmZDYW52YXMjb3BlbmVkXHJcbiAgICovXHJcbiAgb3BlbihldmVudCwgdHJpZ2dlcikge1xyXG4gICAgaWYgKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2lzLW9wZW4nKSB8fCB0aGlzLmlzUmV2ZWFsZWQpIHsgcmV0dXJuOyB9XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGlmICh0cmlnZ2VyKSB7XHJcbiAgICAgIHRoaXMuJGxhc3RUcmlnZ2VyID0gdHJpZ2dlcjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmZvcmNlVG8gPT09ICd0b3AnKSB7XHJcbiAgICAgIHdpbmRvdy5zY3JvbGxUbygwLCAwKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmZvcmNlVG8gPT09ICdib3R0b20nKSB7XHJcbiAgICAgIHdpbmRvdy5zY3JvbGxUbygwLGRvY3VtZW50LmJvZHkuc2Nyb2xsSGVpZ2h0KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIG9mZi1jYW52YXMgbWVudSBvcGVucy5cclxuICAgICAqIEBldmVudCBPZmZDYW52YXMjb3BlbmVkXHJcbiAgICAgKi9cclxuICAgIF90aGlzLiRlbGVtZW50LmFkZENsYXNzKCdpcy1vcGVuJylcclxuXHJcbiAgICB0aGlzLiR0cmlnZ2Vycy5hdHRyKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1oaWRkZW4nLCAnZmFsc2UnKVxyXG4gICAgICAgIC50cmlnZ2VyKCdvcGVuZWQuemYub2ZmY2FudmFzJyk7XHJcblxyXG4gICAgLy8gSWYgYGNvbnRlbnRTY3JvbGxgIGlzIHNldCB0byBmYWxzZSwgYWRkIGNsYXNzIGFuZCBkaXNhYmxlIHNjcm9sbGluZyBvbiB0b3VjaCBkZXZpY2VzLlxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jb250ZW50U2Nyb2xsID09PSBmYWxzZSkge1xyXG4gICAgICAkKCdib2R5JykuYWRkQ2xhc3MoJ2lzLW9mZi1jYW52YXMtb3BlbicpLm9uKCd0b3VjaG1vdmUnLCB0aGlzLl9zdG9wU2Nyb2xsaW5nKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbnRlbnRPdmVybGF5ID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkuYWRkQ2xhc3MoJ2lzLXZpc2libGUnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25DbGljayA9PT0gdHJ1ZSAmJiB0aGlzLm9wdGlvbnMuY29udGVudE92ZXJsYXkgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheS5hZGRDbGFzcygnaXMtY2xvc2FibGUnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmF1dG9Gb2N1cyA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQodGhpcy4kZWxlbWVudCksIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLiRlbGVtZW50LmZpbmQoJ2EsIGJ1dHRvbicpLmVxKDApLmZvY3VzKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudHJhcEZvY3VzID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuc2libGluZ3MoJ1tkYXRhLW9mZi1jYW52YXMtY29udGVudF0nKS5hdHRyKCd0YWJpbmRleCcsICctMScpO1xyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLnRyYXBGb2N1cyh0aGlzLiRlbGVtZW50KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb3NlcyB0aGUgb2ZmLWNhbnZhcyBtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gb3B0aW9uYWwgY2IgdG8gZmlyZSBhZnRlciBjbG9zdXJlLlxyXG4gICAqIEBmaXJlcyBPZmZDYW52YXMjY2xvc2VkXHJcbiAgICovXHJcbiAgY2xvc2UoY2IpIHtcclxuICAgIGlmICghdGhpcy4kZWxlbWVudC5oYXNDbGFzcygnaXMtb3BlbicpIHx8IHRoaXMuaXNSZXZlYWxlZCkgeyByZXR1cm47IH1cclxuXHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIF90aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKCdpcy1vcGVuJyk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJylcclxuICAgICAgLyoqXHJcbiAgICAgICAqIEZpcmVzIHdoZW4gdGhlIG9mZi1jYW52YXMgbWVudSBvcGVucy5cclxuICAgICAgICogQGV2ZW50IE9mZkNhbnZhcyNjbG9zZWRcclxuICAgICAgICovXHJcbiAgICAgICAgLnRyaWdnZXIoJ2Nsb3NlZC56Zi5vZmZjYW52YXMnKTtcclxuXHJcbiAgICAvLyBJZiBgY29udGVudFNjcm9sbGAgaXMgc2V0IHRvIGZhbHNlLCByZW1vdmUgY2xhc3MgYW5kIHJlLWVuYWJsZSBzY3JvbGxpbmcgb24gdG91Y2ggZGV2aWNlcy5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY29udGVudFNjcm9sbCA9PT0gZmFsc2UpIHtcclxuICAgICAgJCgnYm9keScpLnJlbW92ZUNsYXNzKCdpcy1vZmYtY2FudmFzLW9wZW4nKS5vZmYoJ3RvdWNobW92ZScsIHRoaXMuX3N0b3BTY3JvbGxpbmcpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY29udGVudE92ZXJsYXkgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheS5yZW1vdmVDbGFzcygnaXMtdmlzaWJsZScpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrID09PSB0cnVlICYmIHRoaXMub3B0aW9ucy5jb250ZW50T3ZlcmxheSA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5LnJlbW92ZUNsYXNzKCdpcy1jbG9zYWJsZScpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJHRyaWdnZXJzLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnRyYXBGb2N1cyA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnNpYmxpbmdzKCdbZGF0YS1vZmYtY2FudmFzLWNvbnRlbnRdJykucmVtb3ZlQXR0cigndGFiaW5kZXgnKTtcclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWxlYXNlRm9jdXModGhpcy4kZWxlbWVudCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHRoZSBvZmYtY2FudmFzIG1lbnUgb3BlbiBvciBjbG9zZWQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50IC0gRXZlbnQgb2JqZWN0IHBhc3NlZCBmcm9tIGxpc3RlbmVyLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSB0cmlnZ2VyIC0gZWxlbWVudCB0aGF0IHRyaWdnZXJlZCB0aGUgb2ZmLWNhbnZhcyB0byBvcGVuLlxyXG4gICAqL1xyXG4gIHRvZ2dsZShldmVudCwgdHJpZ2dlcikge1xyXG4gICAgaWYgKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2lzLW9wZW4nKSkge1xyXG4gICAgICB0aGlzLmNsb3NlKGV2ZW50LCB0cmlnZ2VyKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICB0aGlzLm9wZW4oZXZlbnQsIHRyaWdnZXIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlcyBrZXlib2FyZCBpbnB1dCB3aGVuIGRldGVjdGVkLiBXaGVuIHRoZSBlc2NhcGUga2V5IGlzIHByZXNzZWQsIHRoZSBvZmYtY2FudmFzIG1lbnUgY2xvc2VzLCBhbmQgZm9jdXMgaXMgcmVzdG9yZWQgdG8gdGhlIGVsZW1lbnQgdGhhdCBvcGVuZWQgdGhlIG1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaGFuZGxlS2V5Ym9hcmQoZSkge1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ09mZkNhbnZhcycsIHtcclxuICAgICAgY2xvc2U6ICgpID0+IHtcclxuICAgICAgICB0aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgdGhpcy4kbGFzdFRyaWdnZXIuZm9jdXMoKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfSxcclxuICAgICAgaGFuZGxlZDogKCkgPT4ge1xyXG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBvZmZjYW52YXMgcGx1Z2luLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLmNsb3NlKCk7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnRyaWdnZXIgLnpmLm9mZmNhbnZhcycpO1xyXG4gICAgdGhpcy4kb3ZlcmxheS5vZmYoJy56Zi5vZmZjYW52YXMnKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5PZmZDYW52YXMuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIHVzZXIgdG8gY2xpY2sgb3V0c2lkZSBvZiB0aGUgbWVudSB0byBjbG9zZSBpdC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsb3NlT25DbGljazogdHJ1ZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhbiBvdmVybGF5IG9uIHRvcCBvZiBgW2RhdGEtb2ZmLWNhbnZhcy1jb250ZW50XWAuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjb250ZW50T3ZlcmxheTogdHJ1ZSxcclxuXHJcbiAgLyoqXHJcbiAgICogRW5hYmxlL2Rpc2FibGUgc2Nyb2xsaW5nIG9mIHRoZSBtYWluIGNvbnRlbnQgd2hlbiBhbiBvZmYgY2FudmFzIHBhbmVsIGlzIG9wZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjb250ZW50U2Nyb2xsOiB0cnVlLFxyXG5cclxuICAvKipcclxuICAgKiBBbW91bnQgb2YgdGltZSBpbiBtcyB0aGUgb3BlbiBhbmQgY2xvc2UgdHJhbnNpdGlvbiByZXF1aXJlcy4gSWYgbm9uZSBzZWxlY3RlZCwgcHVsbHMgZnJvbSBib2R5IHN0eWxlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MDBcclxuICAgKi9cclxuICB0cmFuc2l0aW9uVGltZTogMCxcclxuXHJcbiAgLyoqXHJcbiAgICogVHlwZSBvZiB0cmFuc2l0aW9uIGZvciB0aGUgb2ZmY2FudmFzIG1lbnUuIE9wdGlvbnMgYXJlICdwdXNoJywgJ2RldGFjaGVkJyBvciAnc2xpZGUnLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBwdXNoXHJcbiAgICovXHJcbiAgdHJhbnNpdGlvbjogJ3B1c2gnLFxyXG5cclxuICAvKipcclxuICAgKiBGb3JjZSB0aGUgcGFnZSB0byBzY3JvbGwgdG8gdG9wIG9yIGJvdHRvbSBvbiBvcGVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0b3BcclxuICAgKi9cclxuICBmb3JjZVRvOiBudWxsLFxyXG5cclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgb2ZmY2FudmFzIHRvIHJlbWFpbiBvcGVuIGZvciBjZXJ0YWluIGJyZWFrcG9pbnRzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGlzUmV2ZWFsZWQ6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBCcmVha3BvaW50IGF0IHdoaWNoIHRvIHJldmVhbC4gSlMgd2lsbCB1c2UgYSBSZWdFeHAgdG8gdGFyZ2V0IHN0YW5kYXJkIGNsYXNzZXMsIGlmIGNoYW5naW5nIGNsYXNzbmFtZXMsIHBhc3MgeW91ciBjbGFzcyB3aXRoIHRoZSBgcmV2ZWFsQ2xhc3NgIG9wdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgcmV2ZWFsLWZvci1sYXJnZVxyXG4gICAqL1xyXG4gIHJldmVhbE9uOiBudWxsLFxyXG5cclxuICAvKipcclxuICAgKiBGb3JjZSBmb2N1cyB0byB0aGUgb2ZmY2FudmFzIG9uIG9wZW4uIElmIHRydWUsIHdpbGwgZm9jdXMgdGhlIG9wZW5pbmcgdHJpZ2dlciBvbiBjbG9zZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGF1dG9Gb2N1czogdHJ1ZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgdXNlZCB0byBmb3JjZSBhbiBvZmZjYW52YXMgdG8gcmVtYWluIG9wZW4uIEZvdW5kYXRpb24gZGVmYXVsdHMgZm9yIHRoaXMgYXJlIGByZXZlYWwtZm9yLWxhcmdlYCAmIGByZXZlYWwtZm9yLW1lZGl1bWAuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIFRPRE8gaW1wcm92ZSB0aGUgcmVnZXggdGVzdGluZyBmb3IgdGhpcy5cclxuICAgKiBAZXhhbXBsZSByZXZlYWwtZm9yLWxhcmdlXHJcbiAgICovXHJcbiAgcmV2ZWFsQ2xhc3M6ICdyZXZlYWwtZm9yLScsXHJcblxyXG4gIC8qKlxyXG4gICAqIFRyaWdnZXJzIG9wdGlvbmFsIGZvY3VzIHRyYXBwaW5nIHdoZW4gb3BlbmluZyBhbiBvZmZjYW52YXMuIFNldHMgdGFiaW5kZXggb2YgW2RhdGEtb2ZmLWNhbnZhcy1jb250ZW50XSB0byAtMSBmb3IgYWNjZXNzaWJpbGl0eSBwdXJwb3Nlcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIHRyYXBGb2N1czogZmFsc2VcclxufVxyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oT2ZmQ2FudmFzLCAnT2ZmQ2FudmFzJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogT3JiaXQgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24ub3JiaXRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvblxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRpbWVyQW5kSW1hZ2VMb2FkZXJcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50b3VjaFxyXG4gKi9cclxuXHJcbmNsYXNzIE9yYml0IHtcclxuICAvKipcclxuICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYW4gb3JiaXQgY2Fyb3VzZWwuXHJcbiAgKiBAY2xhc3NcclxuICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYW4gT3JiaXQgQ2Fyb3VzZWwuXHJcbiAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKXtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIE9yYml0LmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ09yYml0Jyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdPcmJpdCcsIHtcclxuICAgICAgJ2x0cic6IHtcclxuICAgICAgICAnQVJST1dfUklHSFQnOiAnbmV4dCcsXHJcbiAgICAgICAgJ0FSUk9XX0xFRlQnOiAncHJldmlvdXMnXHJcbiAgICAgIH0sXHJcbiAgICAgICdydGwnOiB7XHJcbiAgICAgICAgJ0FSUk9XX0xFRlQnOiAnbmV4dCcsXHJcbiAgICAgICAgJ0FSUk9XX1JJR0hUJzogJ3ByZXZpb3VzJ1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogSW5pdGlhbGl6ZXMgdGhlIHBsdWdpbiBieSBjcmVhdGluZyBqUXVlcnkgY29sbGVjdGlvbnMsIHNldHRpbmcgYXR0cmlidXRlcywgYW5kIHN0YXJ0aW5nIHRoZSBhbmltYXRpb24uXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIC8vIEBUT0RPOiBjb25zaWRlciBkaXNjdXNzaW9uIG9uIFBSICM5Mjc4IGFib3V0IERPTSBwb2xsdXRpb24gYnkgY2hhbmdlU2xpZGVcclxuICAgIHRoaXMuX3Jlc2V0KCk7XHJcblxyXG4gICAgdGhpcy4kd3JhcHBlciA9IHRoaXMuJGVsZW1lbnQuZmluZChgLiR7dGhpcy5vcHRpb25zLmNvbnRhaW5lckNsYXNzfWApO1xyXG4gICAgdGhpcy4kc2xpZGVzID0gdGhpcy4kZWxlbWVudC5maW5kKGAuJHt0aGlzLm9wdGlvbnMuc2xpZGVDbGFzc31gKTtcclxuXHJcbiAgICB2YXIgJGltYWdlcyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnaW1nJyksXHJcbiAgICAgICAgaW5pdEFjdGl2ZSA9IHRoaXMuJHNsaWRlcy5maWx0ZXIoJy5pcy1hY3RpdmUnKSxcclxuICAgICAgICBpZCA9IHRoaXMuJGVsZW1lbnRbMF0uaWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnb3JiaXQnKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoe1xyXG4gICAgICAnZGF0YS1yZXNpemUnOiBpZCxcclxuICAgICAgJ2lkJzogaWRcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghaW5pdEFjdGl2ZS5sZW5ndGgpIHtcclxuICAgICAgdGhpcy4kc2xpZGVzLmVxKDApLmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy51c2VNVUkpIHtcclxuICAgICAgdGhpcy4kc2xpZGVzLmFkZENsYXNzKCduby1tb3Rpb251aScpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgkaW1hZ2VzLmxlbmd0aCkge1xyXG4gICAgICBGb3VuZGF0aW9uLm9uSW1hZ2VzTG9hZGVkKCRpbWFnZXMsIHRoaXMuX3ByZXBhcmVGb3JPcmJpdC5iaW5kKHRoaXMpKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX3ByZXBhcmVGb3JPcmJpdCgpOy8vaGVoZVxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYnVsbGV0cykge1xyXG4gICAgICB0aGlzLl9sb2FkQnVsbGV0cygpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b1BsYXkgJiYgdGhpcy4kc2xpZGVzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgdGhpcy5nZW9TeW5jKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hY2Nlc3NpYmxlKSB7IC8vIGFsbG93IHdyYXBwZXIgdG8gYmUgZm9jdXNhYmxlIHRvIGVuYWJsZSBhcnJvdyBuYXZpZ2F0aW9uXHJcbiAgICAgIHRoaXMuJHdyYXBwZXIuYXR0cigndGFiaW5kZXgnLCAwKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogQ3JlYXRlcyBhIGpRdWVyeSBjb2xsZWN0aW9uIG9mIGJ1bGxldHMsIGlmIHRoZXkgYXJlIGJlaW5nIHVzZWQuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKi9cclxuICBfbG9hZEJ1bGxldHMoKSB7XHJcbiAgICB0aGlzLiRidWxsZXRzID0gdGhpcy4kZWxlbWVudC5maW5kKGAuJHt0aGlzLm9wdGlvbnMuYm94T2ZCdWxsZXRzfWApLmZpbmQoJ2J1dHRvbicpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBTZXRzIGEgYHRpbWVyYCBvYmplY3Qgb24gdGhlIG9yYml0LCBhbmQgc3RhcnRzIHRoZSBjb3VudGVyIGZvciB0aGUgbmV4dCBzbGlkZS5cclxuICAqIEBmdW5jdGlvblxyXG4gICovXHJcbiAgZ2VvU3luYygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLnRpbWVyID0gbmV3IEZvdW5kYXRpb24uVGltZXIoXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQsXHJcbiAgICAgIHtcclxuICAgICAgICBkdXJhdGlvbjogdGhpcy5vcHRpb25zLnRpbWVyRGVsYXksXHJcbiAgICAgICAgaW5maW5pdGU6IGZhbHNlXHJcbiAgICAgIH0sXHJcbiAgICAgIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLmNoYW5nZVNsaWRlKHRydWUpO1xyXG4gICAgICB9KTtcclxuICAgIHRoaXMudGltZXIuc3RhcnQoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogU2V0cyB3cmFwcGVyIGFuZCBzbGlkZSBoZWlnaHRzIGZvciB0aGUgb3JiaXQuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKi9cclxuICBfcHJlcGFyZUZvck9yYml0KCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMuX3NldFdyYXBwZXJIZWlnaHQoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogQ2FsdWxhdGVzIHRoZSBoZWlnaHQgb2YgZWFjaCBzbGlkZSBpbiB0aGUgY29sbGVjdGlvbiwgYW5kIHVzZXMgdGhlIHRhbGxlc3Qgb25lIGZvciB0aGUgd3JhcHBlciBoZWlnaHQuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIGEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gZmlyZSB3aGVuIGNvbXBsZXRlLlxyXG4gICovXHJcbiAgX3NldFdyYXBwZXJIZWlnaHQoY2IpIHsvL3Jld3JpdGUgdGhpcyB0byBgZm9yYCBsb29wXHJcbiAgICB2YXIgbWF4ID0gMCwgdGVtcCwgY291bnRlciA9IDAsIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiRzbGlkZXMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgdGVtcCA9IHRoaXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xyXG4gICAgICAkKHRoaXMpLmF0dHIoJ2RhdGEtc2xpZGUnLCBjb3VudGVyKTtcclxuXHJcbiAgICAgIGlmIChfdGhpcy4kc2xpZGVzLmZpbHRlcignLmlzLWFjdGl2ZScpWzBdICE9PSBfdGhpcy4kc2xpZGVzLmVxKGNvdW50ZXIpWzBdKSB7Ly9pZiBub3QgdGhlIGFjdGl2ZSBzbGlkZSwgc2V0IGNzcyBwb3NpdGlvbiBhbmQgZGlzcGxheSBwcm9wZXJ0eVxyXG4gICAgICAgICQodGhpcykuY3NzKHsncG9zaXRpb24nOiAncmVsYXRpdmUnLCAnZGlzcGxheSc6ICdub25lJ30pO1xyXG4gICAgICB9XHJcbiAgICAgIG1heCA9IHRlbXAgPiBtYXggPyB0ZW1wIDogbWF4O1xyXG4gICAgICBjb3VudGVyKys7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoY291bnRlciA9PT0gdGhpcy4kc2xpZGVzLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLiR3cmFwcGVyLmNzcyh7J2hlaWdodCc6IG1heH0pOyAvL29ubHkgY2hhbmdlIHRoZSB3cmFwcGVyIGhlaWdodCBwcm9wZXJ0eSBvbmNlLlxyXG4gICAgICBpZihjYikge2NiKG1heCk7fSAvL2ZpcmUgY2FsbGJhY2sgd2l0aCBtYXggaGVpZ2h0IGRpbWVuc2lvbi5cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogU2V0cyB0aGUgbWF4LWhlaWdodCBvZiBlYWNoIHNsaWRlLlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICovXHJcbiAgX3NldFNsaWRlSGVpZ2h0KGhlaWdodCkge1xyXG4gICAgdGhpcy4kc2xpZGVzLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgICQodGhpcykuY3NzKCdtYXgtaGVpZ2h0JywgaGVpZ2h0KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBBZGRzIGV2ZW50IGxpc3RlbmVycyB0byBiYXNpY2FsbHkgZXZlcnl0aGluZyB3aXRoaW4gdGhlIGVsZW1lbnQuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgLy8qKk5vdyB1c2luZyBjdXN0b20gZXZlbnQgLSB0aGFua3MgdG86KipcclxuICAgIC8vKiogICAgICBZb2hhaSBBcmFyYXQgb2YgVG9yb250byAgICAgICoqXHJcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgLy9cclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcucmVzaXplbWUuemYudHJpZ2dlcicpLm9uKHtcclxuICAgICAgJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInOiB0aGlzLl9wcmVwYXJlRm9yT3JiaXQuYmluZCh0aGlzKVxyXG4gICAgfSlcclxuICAgIGlmICh0aGlzLiRzbGlkZXMubGVuZ3RoID4gMSkge1xyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5zd2lwZSkge1xyXG4gICAgICAgIHRoaXMuJHNsaWRlcy5vZmYoJ3N3aXBlbGVmdC56Zi5vcmJpdCBzd2lwZXJpZ2h0LnpmLm9yYml0JylcclxuICAgICAgICAub24oJ3N3aXBlbGVmdC56Zi5vcmJpdCcsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgX3RoaXMuY2hhbmdlU2xpZGUodHJ1ZSk7XHJcbiAgICAgICAgfSkub24oJ3N3aXBlcmlnaHQuemYub3JiaXQnLCBmdW5jdGlvbihlKXtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIF90aGlzLmNoYW5nZVNsaWRlKGZhbHNlKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5hdXRvUGxheSkge1xyXG4gICAgICAgIHRoaXMuJHNsaWRlcy5vbignY2xpY2suemYub3JiaXQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIF90aGlzLiRlbGVtZW50LmRhdGEoJ2NsaWNrZWRPbicsIF90aGlzLiRlbGVtZW50LmRhdGEoJ2NsaWNrZWRPbicpID8gZmFsc2UgOiB0cnVlKTtcclxuICAgICAgICAgIF90aGlzLnRpbWVyW190aGlzLiRlbGVtZW50LmRhdGEoJ2NsaWNrZWRPbicpID8gJ3BhdXNlJyA6ICdzdGFydCddKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucGF1c2VPbkhvdmVyKSB7XHJcbiAgICAgICAgICB0aGlzLiRlbGVtZW50Lm9uKCdtb3VzZWVudGVyLnpmLm9yYml0JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnRpbWVyLnBhdXNlKCk7XHJcbiAgICAgICAgICB9KS5vbignbW91c2VsZWF2ZS56Zi5vcmJpdCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZiAoIV90aGlzLiRlbGVtZW50LmRhdGEoJ2NsaWNrZWRPbicpKSB7XHJcbiAgICAgICAgICAgICAgX3RoaXMudGltZXIuc3RhcnQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLm5hdkJ1dHRvbnMpIHtcclxuICAgICAgICB2YXIgJGNvbnRyb2xzID0gdGhpcy4kZWxlbWVudC5maW5kKGAuJHt0aGlzLm9wdGlvbnMubmV4dENsYXNzfSwgLiR7dGhpcy5vcHRpb25zLnByZXZDbGFzc31gKTtcclxuICAgICAgICAkY29udHJvbHMuYXR0cigndGFiaW5kZXgnLCAwKVxyXG4gICAgICAgIC8vYWxzbyBuZWVkIHRvIGhhbmRsZSBlbnRlci9yZXR1cm4gYW5kIHNwYWNlYmFyIGtleSBwcmVzc2VzXHJcbiAgICAgICAgLm9uKCdjbGljay56Zi5vcmJpdCB0b3VjaGVuZC56Zi5vcmJpdCcsIGZ1bmN0aW9uKGUpe1xyXG5cdCAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgX3RoaXMuY2hhbmdlU2xpZGUoJCh0aGlzKS5oYXNDbGFzcyhfdGhpcy5vcHRpb25zLm5leHRDbGFzcykpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmJ1bGxldHMpIHtcclxuICAgICAgICB0aGlzLiRidWxsZXRzLm9uKCdjbGljay56Zi5vcmJpdCB0b3VjaGVuZC56Zi5vcmJpdCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKC9pcy1hY3RpdmUvZy50ZXN0KHRoaXMuY2xhc3NOYW1lKSkgeyByZXR1cm4gZmFsc2U7IH0vL2lmIHRoaXMgaXMgYWN0aXZlLCBraWNrIG91dCBvZiBmdW5jdGlvbi5cclxuICAgICAgICAgIHZhciBpZHggPSAkKHRoaXMpLmRhdGEoJ3NsaWRlJyksXHJcbiAgICAgICAgICBsdHIgPSBpZHggPiBfdGhpcy4kc2xpZGVzLmZpbHRlcignLmlzLWFjdGl2ZScpLmRhdGEoJ3NsaWRlJyksXHJcbiAgICAgICAgICAkc2xpZGUgPSBfdGhpcy4kc2xpZGVzLmVxKGlkeCk7XHJcblxyXG4gICAgICAgICAgX3RoaXMuY2hhbmdlU2xpZGUobHRyLCAkc2xpZGUsIGlkeCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuYWNjZXNzaWJsZSkge1xyXG4gICAgICAgIHRoaXMuJHdyYXBwZXIuYWRkKHRoaXMuJGJ1bGxldHMpLm9uKCdrZXlkb3duLnpmLm9yYml0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgLy8gaGFuZGxlIGtleWJvYXJkIGV2ZW50IHdpdGgga2V5Ym9hcmQgdXRpbFxyXG4gICAgICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ09yYml0Jywge1xyXG4gICAgICAgICAgICBuZXh0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICBfdGhpcy5jaGFuZ2VTbGlkZSh0cnVlKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcHJldmlvdXM6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgIF90aGlzLmNoYW5nZVNsaWRlKGZhbHNlKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24oKSB7IC8vIGlmIGJ1bGxldCBpcyBmb2N1c2VkLCBtYWtlIHN1cmUgZm9jdXMgbW92ZXNcclxuICAgICAgICAgICAgICBpZiAoJChlLnRhcmdldCkuaXMoX3RoaXMuJGJ1bGxldHMpKSB7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy4kYnVsbGV0cy5maWx0ZXIoJy5pcy1hY3RpdmUnKS5mb2N1cygpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc2V0cyBPcmJpdCBzbyBpdCBjYW4gYmUgcmVpbml0aWFsaXplZFxyXG4gICAqL1xyXG4gIF9yZXNldCgpIHtcclxuICAgIC8vIERvbid0IGRvIGFueXRoaW5nIGlmIHRoZXJlIGFyZSBubyBzbGlkZXMgKGZpcnN0IHJ1bilcclxuICAgIGlmICh0eXBlb2YgdGhpcy4kc2xpZGVzID09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy4kc2xpZGVzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgLy8gUmVtb3ZlIG9sZCBldmVudHNcclxuICAgICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi5vcmJpdCcpLmZpbmQoJyonKS5vZmYoJy56Zi5vcmJpdCcpXHJcblxyXG4gICAgICAvLyBSZXN0YXJ0IHRpbWVyIGlmIGF1dG9QbGF5IGlzIGVuYWJsZWRcclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5hdXRvUGxheSkge1xyXG4gICAgICAgIHRoaXMudGltZXIucmVzdGFydCgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBSZXNldCBhbGwgc2xpZGRlc1xyXG4gICAgICB0aGlzLiRzbGlkZXMuZWFjaChmdW5jdGlvbihlbCkge1xyXG4gICAgICAgICQoZWwpLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUgaXMtYWN0aXZlIGlzLWluJylcclxuICAgICAgICAgIC5yZW1vdmVBdHRyKCdhcmlhLWxpdmUnKVxyXG4gICAgICAgICAgLmhpZGUoKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBTaG93IHRoZSBmaXJzdCBzbGlkZVxyXG4gICAgICB0aGlzLiRzbGlkZXMuZmlyc3QoKS5hZGRDbGFzcygnaXMtYWN0aXZlJykuc2hvdygpO1xyXG5cclxuICAgICAgLy8gVHJpZ2dlcnMgd2hlbiB0aGUgc2xpZGUgaGFzIGZpbmlzaGVkIGFuaW1hdGluZ1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3NsaWRlY2hhbmdlLnpmLm9yYml0JywgW3RoaXMuJHNsaWRlcy5maXJzdCgpXSk7XHJcblxyXG4gICAgICAvLyBTZWxlY3QgZmlyc3QgYnVsbGV0IGlmIGJ1bGxldHMgYXJlIHByZXNlbnRcclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5idWxsZXRzKSB7XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlQnVsbGV0cygwKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBDaGFuZ2VzIHRoZSBjdXJyZW50IHNsaWRlIHRvIGEgbmV3IG9uZS5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHBhcmFtIHtCb29sZWFufSBpc0xUUiAtIGZsYWcgaWYgdGhlIHNsaWRlIHNob3VsZCBtb3ZlIGxlZnQgdG8gcmlnaHQuXHJcbiAgKiBAcGFyYW0ge2pRdWVyeX0gY2hvc2VuU2xpZGUgLSB0aGUgalF1ZXJ5IGVsZW1lbnQgb2YgdGhlIHNsaWRlIHRvIHNob3cgbmV4dCwgaWYgb25lIGlzIHNlbGVjdGVkLlxyXG4gICogQHBhcmFtIHtOdW1iZXJ9IGlkeCAtIHRoZSBpbmRleCBvZiB0aGUgbmV3IHNsaWRlIGluIGl0cyBjb2xsZWN0aW9uLCBpZiBvbmUgY2hvc2VuLlxyXG4gICogQGZpcmVzIE9yYml0I3NsaWRlY2hhbmdlXHJcbiAgKi9cclxuICBjaGFuZ2VTbGlkZShpc0xUUiwgY2hvc2VuU2xpZGUsIGlkeCkge1xyXG4gICAgaWYgKCF0aGlzLiRzbGlkZXMpIHtyZXR1cm47IH0gLy8gRG9uJ3QgZnJlYWsgb3V0IGlmIHdlJ3JlIGluIHRoZSBtaWRkbGUgb2YgY2xlYW51cFxyXG4gICAgdmFyICRjdXJTbGlkZSA9IHRoaXMuJHNsaWRlcy5maWx0ZXIoJy5pcy1hY3RpdmUnKS5lcSgwKTtcclxuXHJcbiAgICBpZiAoL211aS9nLnRlc3QoJGN1clNsaWRlWzBdLmNsYXNzTmFtZSkpIHsgcmV0dXJuIGZhbHNlOyB9IC8vaWYgdGhlIHNsaWRlIGlzIGN1cnJlbnRseSBhbmltYXRpbmcsIGtpY2sgb3V0IG9mIHRoZSBmdW5jdGlvblxyXG5cclxuICAgIHZhciAkZmlyc3RTbGlkZSA9IHRoaXMuJHNsaWRlcy5maXJzdCgpLFxyXG4gICAgJGxhc3RTbGlkZSA9IHRoaXMuJHNsaWRlcy5sYXN0KCksXHJcbiAgICBkaXJJbiA9IGlzTFRSID8gJ1JpZ2h0JyA6ICdMZWZ0JyxcclxuICAgIGRpck91dCA9IGlzTFRSID8gJ0xlZnQnIDogJ1JpZ2h0JyxcclxuICAgIF90aGlzID0gdGhpcyxcclxuICAgICRuZXdTbGlkZTtcclxuXHJcbiAgICBpZiAoIWNob3NlblNsaWRlKSB7IC8vbW9zdCBvZiB0aGUgdGltZSwgdGhpcyB3aWxsIGJlIGF1dG8gcGxheWVkIG9yIGNsaWNrZWQgZnJvbSB0aGUgbmF2QnV0dG9ucy5cclxuICAgICAgJG5ld1NsaWRlID0gaXNMVFIgPyAvL2lmIHdyYXBwaW5nIGVuYWJsZWQsIGNoZWNrIHRvIHNlZSBpZiB0aGVyZSBpcyBhIGBuZXh0YCBvciBgcHJldmAgc2libGluZywgaWYgbm90LCBzZWxlY3QgdGhlIGZpcnN0IG9yIGxhc3Qgc2xpZGUgdG8gZmlsbCBpbi4gaWYgd3JhcHBpbmcgbm90IGVuYWJsZWQsIGF0dGVtcHQgdG8gc2VsZWN0IGBuZXh0YCBvciBgcHJldmAsIGlmIHRoZXJlJ3Mgbm90aGluZyB0aGVyZSwgdGhlIGZ1bmN0aW9uIHdpbGwga2ljayBvdXQgb24gbmV4dCBzdGVwLiBDUkFaWSBORVNURUQgVEVSTkFSSUVTISEhISFcclxuICAgICAgKHRoaXMub3B0aW9ucy5pbmZpbml0ZVdyYXAgPyAkY3VyU2xpZGUubmV4dChgLiR7dGhpcy5vcHRpb25zLnNsaWRlQ2xhc3N9YCkubGVuZ3RoID8gJGN1clNsaWRlLm5leHQoYC4ke3RoaXMub3B0aW9ucy5zbGlkZUNsYXNzfWApIDogJGZpcnN0U2xpZGUgOiAkY3VyU2xpZGUubmV4dChgLiR7dGhpcy5vcHRpb25zLnNsaWRlQ2xhc3N9YCkpLy9waWNrIG5leHQgc2xpZGUgaWYgbW92aW5nIGxlZnQgdG8gcmlnaHRcclxuICAgICAgOlxyXG4gICAgICAodGhpcy5vcHRpb25zLmluZmluaXRlV3JhcCA/ICRjdXJTbGlkZS5wcmV2KGAuJHt0aGlzLm9wdGlvbnMuc2xpZGVDbGFzc31gKS5sZW5ndGggPyAkY3VyU2xpZGUucHJldihgLiR7dGhpcy5vcHRpb25zLnNsaWRlQ2xhc3N9YCkgOiAkbGFzdFNsaWRlIDogJGN1clNsaWRlLnByZXYoYC4ke3RoaXMub3B0aW9ucy5zbGlkZUNsYXNzfWApKTsvL3BpY2sgcHJldiBzbGlkZSBpZiBtb3ZpbmcgcmlnaHQgdG8gbGVmdFxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgJG5ld1NsaWRlID0gY2hvc2VuU2xpZGU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCRuZXdTbGlkZS5sZW5ndGgpIHtcclxuICAgICAgLyoqXHJcbiAgICAgICogVHJpZ2dlcnMgYmVmb3JlIHRoZSBuZXh0IHNsaWRlIHN0YXJ0cyBhbmltYXRpbmcgaW4gYW5kIG9ubHkgaWYgYSBuZXh0IHNsaWRlIGhhcyBiZWVuIGZvdW5kLlxyXG4gICAgICAqIEBldmVudCBPcmJpdCNiZWZvcmVzbGlkZWNoYW5nZVxyXG4gICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2JlZm9yZXNsaWRlY2hhbmdlLnpmLm9yYml0JywgWyRjdXJTbGlkZSwgJG5ld1NsaWRlXSk7XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmJ1bGxldHMpIHtcclxuICAgICAgICBpZHggPSBpZHggfHwgdGhpcy4kc2xpZGVzLmluZGV4KCRuZXdTbGlkZSk7IC8vZ3JhYiBpbmRleCB0byB1cGRhdGUgYnVsbGV0c1xyXG4gICAgICAgIHRoaXMuX3VwZGF0ZUJ1bGxldHMoaWR4KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy51c2VNVUkgJiYgIXRoaXMuJGVsZW1lbnQuaXMoJzpoaWRkZW4nKSkge1xyXG4gICAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVJbihcclxuICAgICAgICAgICRuZXdTbGlkZS5hZGRDbGFzcygnaXMtYWN0aXZlJykuY3NzKHsncG9zaXRpb24nOiAnYWJzb2x1dGUnLCAndG9wJzogMH0pLFxyXG4gICAgICAgICAgdGhpcy5vcHRpb25zW2BhbmltSW5Gcm9tJHtkaXJJbn1gXSxcclxuICAgICAgICAgIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICRuZXdTbGlkZS5jc3Moeydwb3NpdGlvbic6ICdyZWxhdGl2ZScsICdkaXNwbGF5JzogJ2Jsb2NrJ30pXHJcbiAgICAgICAgICAgIC5hdHRyKCdhcmlhLWxpdmUnLCAncG9saXRlJyk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVPdXQoXHJcbiAgICAgICAgICAkY3VyU2xpZGUucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZScpLFxyXG4gICAgICAgICAgdGhpcy5vcHRpb25zW2BhbmltT3V0VG8ke2Rpck91dH1gXSxcclxuICAgICAgICAgIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICRjdXJTbGlkZS5yZW1vdmVBdHRyKCdhcmlhLWxpdmUnKTtcclxuICAgICAgICAgICAgaWYoX3RoaXMub3B0aW9ucy5hdXRvUGxheSAmJiAhX3RoaXMudGltZXIuaXNQYXVzZWQpe1xyXG4gICAgICAgICAgICAgIF90aGlzLnRpbWVyLnJlc3RhcnQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvL2RvIHN0dWZmP1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgJGN1clNsaWRlLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUgaXMtaW4nKS5yZW1vdmVBdHRyKCdhcmlhLWxpdmUnKS5oaWRlKCk7XHJcbiAgICAgICAgJG5ld1NsaWRlLmFkZENsYXNzKCdpcy1hY3RpdmUgaXMtaW4nKS5hdHRyKCdhcmlhLWxpdmUnLCAncG9saXRlJykuc2hvdygpO1xyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b1BsYXkgJiYgIXRoaXMudGltZXIuaXNQYXVzZWQpIHtcclxuICAgICAgICAgIHRoaXMudGltZXIucmVzdGFydCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgLyoqXHJcbiAgICAqIFRyaWdnZXJzIHdoZW4gdGhlIHNsaWRlIGhhcyBmaW5pc2hlZCBhbmltYXRpbmcgaW4uXHJcbiAgICAqIEBldmVudCBPcmJpdCNzbGlkZWNoYW5nZVxyXG4gICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdzbGlkZWNoYW5nZS56Zi5vcmJpdCcsIFskbmV3U2xpZGVdKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogVXBkYXRlcyB0aGUgYWN0aXZlIHN0YXRlIG9mIHRoZSBidWxsZXRzLCBpZiBkaXNwbGF5ZWQuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKiBAcGFyYW0ge051bWJlcn0gaWR4IC0gdGhlIGluZGV4IG9mIHRoZSBjdXJyZW50IHNsaWRlLlxyXG4gICovXHJcbiAgX3VwZGF0ZUJ1bGxldHMoaWR4KSB7XHJcbiAgICB2YXIgJG9sZEJ1bGxldCA9IHRoaXMuJGVsZW1lbnQuZmluZChgLiR7dGhpcy5vcHRpb25zLmJveE9mQnVsbGV0c31gKVxyXG4gICAgLmZpbmQoJy5pcy1hY3RpdmUnKS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlJykuYmx1cigpLFxyXG4gICAgc3BhbiA9ICRvbGRCdWxsZXQuZmluZCgnc3BhbjpsYXN0JykuZGV0YWNoKCksXHJcbiAgICAkbmV3QnVsbGV0ID0gdGhpcy4kYnVsbGV0cy5lcShpZHgpLmFkZENsYXNzKCdpcy1hY3RpdmUnKS5hcHBlbmQoc3Bhbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIERlc3Ryb3lzIHRoZSBjYXJvdXNlbCBhbmQgaGlkZXMgdGhlIGVsZW1lbnQuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLm9yYml0JykuZmluZCgnKicpLm9mZignLnpmLm9yYml0JykuZW5kKCkuaGlkZSgpO1xyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuT3JiaXQuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgKiBUZWxscyB0aGUgSlMgdG8gbG9vayBmb3IgYW5kIGxvYWRCdWxsZXRzLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgYnVsbGV0czogdHJ1ZSxcclxuICAvKipcclxuICAqIFRlbGxzIHRoZSBKUyB0byBhcHBseSBldmVudCBsaXN0ZW5lcnMgdG8gbmF2IGJ1dHRvbnNcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIG5hdkJ1dHRvbnM6IHRydWUsXHJcbiAgLyoqXHJcbiAgKiBtb3Rpb24tdWkgYW5pbWF0aW9uIGNsYXNzIHRvIGFwcGx5XHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnc2xpZGUtaW4tcmlnaHQnXHJcbiAgKi9cclxuICBhbmltSW5Gcm9tUmlnaHQ6ICdzbGlkZS1pbi1yaWdodCcsXHJcbiAgLyoqXHJcbiAgKiBtb3Rpb24tdWkgYW5pbWF0aW9uIGNsYXNzIHRvIGFwcGx5XHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnc2xpZGUtb3V0LXJpZ2h0J1xyXG4gICovXHJcbiAgYW5pbU91dFRvUmlnaHQ6ICdzbGlkZS1vdXQtcmlnaHQnLFxyXG4gIC8qKlxyXG4gICogbW90aW9uLXVpIGFuaW1hdGlvbiBjbGFzcyB0byBhcHBseVxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ3NsaWRlLWluLWxlZnQnXHJcbiAgKlxyXG4gICovXHJcbiAgYW5pbUluRnJvbUxlZnQ6ICdzbGlkZS1pbi1sZWZ0JyxcclxuICAvKipcclxuICAqIG1vdGlvbi11aSBhbmltYXRpb24gY2xhc3MgdG8gYXBwbHlcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdzbGlkZS1vdXQtbGVmdCdcclxuICAqL1xyXG4gIGFuaW1PdXRUb0xlZnQ6ICdzbGlkZS1vdXQtbGVmdCcsXHJcbiAgLyoqXHJcbiAgKiBBbGxvd3MgT3JiaXQgdG8gYXV0b21hdGljYWxseSBhbmltYXRlIG9uIHBhZ2UgbG9hZC5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIGF1dG9QbGF5OiB0cnVlLFxyXG4gIC8qKlxyXG4gICogQW1vdW50IG9mIHRpbWUsIGluIG1zLCBiZXR3ZWVuIHNsaWRlIHRyYW5zaXRpb25zXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSA1MDAwXHJcbiAgKi9cclxuICB0aW1lckRlbGF5OiA1MDAwLFxyXG4gIC8qKlxyXG4gICogQWxsb3dzIE9yYml0IHRvIGluZmluaXRlbHkgbG9vcCB0aHJvdWdoIHRoZSBzbGlkZXNcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIGluZmluaXRlV3JhcDogdHJ1ZSxcclxuICAvKipcclxuICAqIEFsbG93cyB0aGUgT3JiaXQgc2xpZGVzIHRvIGJpbmQgdG8gc3dpcGUgZXZlbnRzIGZvciBtb2JpbGUsIHJlcXVpcmVzIGFuIGFkZGl0aW9uYWwgdXRpbCBsaWJyYXJ5XHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICBzd2lwZTogdHJ1ZSxcclxuICAvKipcclxuICAqIEFsbG93cyB0aGUgdGltaW5nIGZ1bmN0aW9uIHRvIHBhdXNlIGFuaW1hdGlvbiBvbiBob3Zlci5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIHBhdXNlT25Ib3ZlcjogdHJ1ZSxcclxuICAvKipcclxuICAqIEFsbG93cyBPcmJpdCB0byBiaW5kIGtleWJvYXJkIGV2ZW50cyB0byB0aGUgc2xpZGVyLCB0byBhbmltYXRlIGZyYW1lcyB3aXRoIGFycm93IGtleXNcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIGFjY2Vzc2libGU6IHRydWUsXHJcbiAgLyoqXHJcbiAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBjb250YWluZXIgb2YgT3JiaXRcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdvcmJpdC1jb250YWluZXInXHJcbiAgKi9cclxuICBjb250YWluZXJDbGFzczogJ29yYml0LWNvbnRhaW5lcicsXHJcbiAgLyoqXHJcbiAgKiBDbGFzcyBhcHBsaWVkIHRvIGluZGl2aWR1YWwgc2xpZGVzLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ29yYml0LXNsaWRlJ1xyXG4gICovXHJcbiAgc2xpZGVDbGFzczogJ29yYml0LXNsaWRlJyxcclxuICAvKipcclxuICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGJ1bGxldCBjb250YWluZXIuIFlvdSdyZSB3ZWxjb21lLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ29yYml0LWJ1bGxldHMnXHJcbiAgKi9cclxuICBib3hPZkJ1bGxldHM6ICdvcmJpdC1idWxsZXRzJyxcclxuICAvKipcclxuICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGBuZXh0YCBuYXZpZ2F0aW9uIGJ1dHRvbi5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdvcmJpdC1uZXh0J1xyXG4gICovXHJcbiAgbmV4dENsYXNzOiAnb3JiaXQtbmV4dCcsXHJcbiAgLyoqXHJcbiAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBgcHJldmlvdXNgIG5hdmlnYXRpb24gYnV0dG9uLlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ29yYml0LXByZXZpb3VzJ1xyXG4gICovXHJcbiAgcHJldkNsYXNzOiAnb3JiaXQtcHJldmlvdXMnLFxyXG4gIC8qKlxyXG4gICogQm9vbGVhbiB0byBmbGFnIHRoZSBqcyB0byB1c2UgbW90aW9uIHVpIGNsYXNzZXMgb3Igbm90LiBEZWZhdWx0IHRvIHRydWUgZm9yIGJhY2t3YXJkcyBjb21wYXRhYmlsaXR5LlxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgdXNlTVVJOiB0cnVlXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihPcmJpdCwgJ09yYml0Jyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogUmVzcG9uc2l2ZU1lbnUgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24ucmVzcG9uc2l2ZU1lbnVcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5hY2NvcmRpb25NZW51XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwuZHJpbGxkb3duXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwuZHJvcGRvd24tbWVudVxyXG4gKi9cclxuXHJcbmNsYXNzIFJlc3BvbnNpdmVNZW51IHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGEgcmVzcG9uc2l2ZSBtZW51LlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBSZXNwb25zaXZlTWVudSNpbml0XHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhIGRyb3Bkb3duIG1lbnUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSAkKGVsZW1lbnQpO1xyXG4gICAgdGhpcy5ydWxlcyA9IHRoaXMuJGVsZW1lbnQuZGF0YSgncmVzcG9uc2l2ZS1tZW51Jyk7XHJcbiAgICB0aGlzLmN1cnJlbnRNcSA9IG51bGw7XHJcbiAgICB0aGlzLmN1cnJlbnRQbHVnaW4gPSBudWxsO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1Jlc3BvbnNpdmVNZW51Jyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgTWVudSBieSBwYXJzaW5nIHRoZSBjbGFzc2VzIGZyb20gdGhlICdkYXRhLVJlc3BvbnNpdmVNZW51JyBhdHRyaWJ1dGUgb24gdGhlIGVsZW1lbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIC8vIFRoZSBmaXJzdCB0aW1lIGFuIEludGVyY2hhbmdlIHBsdWdpbiBpcyBpbml0aWFsaXplZCwgdGhpcy5ydWxlcyBpcyBjb252ZXJ0ZWQgZnJvbSBhIHN0cmluZyBvZiBcImNsYXNzZXNcIiB0byBhbiBvYmplY3Qgb2YgcnVsZXNcclxuICAgIGlmICh0eXBlb2YgdGhpcy5ydWxlcyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgbGV0IHJ1bGVzVHJlZSA9IHt9O1xyXG5cclxuICAgICAgLy8gUGFyc2UgcnVsZXMgZnJvbSBcImNsYXNzZXNcIiBwdWxsZWQgZnJvbSBkYXRhIGF0dHJpYnV0ZVxyXG4gICAgICBsZXQgcnVsZXMgPSB0aGlzLnJ1bGVzLnNwbGl0KCcgJyk7XHJcblxyXG4gICAgICAvLyBJdGVyYXRlIHRocm91Z2ggZXZlcnkgcnVsZSBmb3VuZFxyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgbGV0IHJ1bGUgPSBydWxlc1tpXS5zcGxpdCgnLScpO1xyXG4gICAgICAgIGxldCBydWxlU2l6ZSA9IHJ1bGUubGVuZ3RoID4gMSA/IHJ1bGVbMF0gOiAnc21hbGwnO1xyXG4gICAgICAgIGxldCBydWxlUGx1Z2luID0gcnVsZS5sZW5ndGggPiAxID8gcnVsZVsxXSA6IHJ1bGVbMF07XHJcblxyXG4gICAgICAgIGlmIChNZW51UGx1Z2luc1tydWxlUGx1Z2luXSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgcnVsZXNUcmVlW3J1bGVTaXplXSA9IE1lbnVQbHVnaW5zW3J1bGVQbHVnaW5dO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy5ydWxlcyA9IHJ1bGVzVHJlZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoISQuaXNFbXB0eU9iamVjdCh0aGlzLnJ1bGVzKSkge1xyXG4gICAgICB0aGlzLl9jaGVja01lZGlhUXVlcmllcygpO1xyXG4gICAgfVxyXG4gICAgLy8gQWRkIGRhdGEtbXV0YXRlIHNpbmNlIGNoaWxkcmVuIG1heSBuZWVkIGl0LlxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdkYXRhLW11dGF0ZScsICh0aGlzLiRlbGVtZW50LmF0dHIoJ2RhdGEtbXV0YXRlJykgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAncmVzcG9uc2l2ZS1tZW51JykpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIGV2ZW50cyBmb3IgdGhlIE1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICAkKHdpbmRvdykub24oJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBfdGhpcy5fY2hlY2tNZWRpYVF1ZXJpZXMoKTtcclxuICAgIH0pO1xyXG4gICAgLy8gJCh3aW5kb3cpLm9uKCdyZXNpemUuemYuUmVzcG9uc2l2ZU1lbnUnLCBmdW5jdGlvbigpIHtcclxuICAgIC8vICAgX3RoaXMuX2NoZWNrTWVkaWFRdWVyaWVzKCk7XHJcbiAgICAvLyB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyB0aGUgY3VycmVudCBzY3JlZW4gd2lkdGggYWdhaW5zdCBhdmFpbGFibGUgbWVkaWEgcXVlcmllcy4gSWYgdGhlIG1lZGlhIHF1ZXJ5IGhhcyBjaGFuZ2VkLCBhbmQgdGhlIHBsdWdpbiBuZWVkZWQgaGFzIGNoYW5nZWQsIHRoZSBwbHVnaW5zIHdpbGwgc3dhcCBvdXQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfY2hlY2tNZWRpYVF1ZXJpZXMoKSB7XHJcbiAgICB2YXIgbWF0Y2hlZE1xLCBfdGhpcyA9IHRoaXM7XHJcbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggZWFjaCBydWxlIGFuZCBmaW5kIHRoZSBsYXN0IG1hdGNoaW5nIHJ1bGVcclxuICAgICQuZWFjaCh0aGlzLnJ1bGVzLCBmdW5jdGlvbihrZXkpIHtcclxuICAgICAgaWYgKEZvdW5kYXRpb24uTWVkaWFRdWVyeS5hdExlYXN0KGtleSkpIHtcclxuICAgICAgICBtYXRjaGVkTXEgPSBrZXk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE5vIG1hdGNoPyBObyBkaWNlXHJcbiAgICBpZiAoIW1hdGNoZWRNcSkgcmV0dXJuO1xyXG5cclxuICAgIC8vIFBsdWdpbiBhbHJlYWR5IGluaXRpYWxpemVkPyBXZSBnb29kXHJcbiAgICBpZiAodGhpcy5jdXJyZW50UGx1Z2luIGluc3RhbmNlb2YgdGhpcy5ydWxlc1ttYXRjaGVkTXFdLnBsdWdpbikgcmV0dXJuO1xyXG5cclxuICAgIC8vIFJlbW92ZSBleGlzdGluZyBwbHVnaW4tc3BlY2lmaWMgQ1NTIGNsYXNzZXNcclxuICAgICQuZWFjaChNZW51UGx1Z2lucywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xyXG4gICAgICBfdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyh2YWx1ZS5jc3NDbGFzcyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgdGhlIENTUyBjbGFzcyBmb3IgdGhlIG5ldyBwbHVnaW5cclxuICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3ModGhpcy5ydWxlc1ttYXRjaGVkTXFdLmNzc0NsYXNzKTtcclxuXHJcbiAgICAvLyBDcmVhdGUgYW4gaW5zdGFuY2Ugb2YgdGhlIG5ldyBwbHVnaW5cclxuICAgIGlmICh0aGlzLmN1cnJlbnRQbHVnaW4pIHRoaXMuY3VycmVudFBsdWdpbi5kZXN0cm95KCk7XHJcbiAgICB0aGlzLmN1cnJlbnRQbHVnaW4gPSBuZXcgdGhpcy5ydWxlc1ttYXRjaGVkTXFdLnBsdWdpbih0aGlzLiRlbGVtZW50LCB7fSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgaW5zdGFuY2Ugb2YgdGhlIGN1cnJlbnQgcGx1Z2luIG9uIHRoaXMgZWxlbWVudCwgYXMgd2VsbCBhcyB0aGUgd2luZG93IHJlc2l6ZSBoYW5kbGVyIHRoYXQgc3dpdGNoZXMgdGhlIHBsdWdpbnMgb3V0LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLmN1cnJlbnRQbHVnaW4uZGVzdHJveSgpO1xyXG4gICAgJCh3aW5kb3cpLm9mZignLnpmLlJlc3BvbnNpdmVNZW51Jyk7XHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5SZXNwb25zaXZlTWVudS5kZWZhdWx0cyA9IHt9O1xyXG5cclxuLy8gVGhlIHBsdWdpbiBtYXRjaGVzIHRoZSBwbHVnaW4gY2xhc3NlcyB3aXRoIHRoZXNlIHBsdWdpbiBpbnN0YW5jZXMuXHJcbnZhciBNZW51UGx1Z2lucyA9IHtcclxuICBkcm9wZG93bjoge1xyXG4gICAgY3NzQ2xhc3M6ICdkcm9wZG93bicsXHJcbiAgICBwbHVnaW46IEZvdW5kYXRpb24uX3BsdWdpbnNbJ2Ryb3Bkb3duLW1lbnUnXSB8fCBudWxsXHJcbiAgfSxcclxuIGRyaWxsZG93bjoge1xyXG4gICAgY3NzQ2xhc3M6ICdkcmlsbGRvd24nLFxyXG4gICAgcGx1Z2luOiBGb3VuZGF0aW9uLl9wbHVnaW5zWydkcmlsbGRvd24nXSB8fCBudWxsXHJcbiAgfSxcclxuICBhY2NvcmRpb246IHtcclxuICAgIGNzc0NsYXNzOiAnYWNjb3JkaW9uLW1lbnUnLFxyXG4gICAgcGx1Z2luOiBGb3VuZGF0aW9uLl9wbHVnaW5zWydhY2NvcmRpb24tbWVudSddIHx8IG51bGxcclxuICB9XHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihSZXNwb25zaXZlTWVudSwgJ1Jlc3BvbnNpdmVNZW51Jyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogUmVzcG9uc2l2ZVRvZ2dsZSBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5yZXNwb25zaXZlVG9nZ2xlXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKi9cclxuXHJcbmNsYXNzIFJlc3BvbnNpdmVUb2dnbGUge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgVGFiIEJhci5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgUmVzcG9uc2l2ZVRvZ2dsZSNpbml0XHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGF0dGFjaCB0YWIgYmFyIGZ1bmN0aW9uYWxpdHkgdG8uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSAkKGVsZW1lbnQpO1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIFJlc3BvbnNpdmVUb2dnbGUuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdSZXNwb25zaXZlVG9nZ2xlJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgdGFiIGJhciBieSBmaW5kaW5nIHRoZSB0YXJnZXQgZWxlbWVudCwgdG9nZ2xpbmcgZWxlbWVudCwgYW5kIHJ1bm5pbmcgdXBkYXRlKCkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciB0YXJnZXRJRCA9IHRoaXMuJGVsZW1lbnQuZGF0YSgncmVzcG9uc2l2ZS10b2dnbGUnKTtcclxuICAgIGlmICghdGFyZ2V0SUQpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignWW91ciB0YWIgYmFyIG5lZWRzIGFuIElEIG9mIGEgTWVudSBhcyB0aGUgdmFsdWUgb2YgZGF0YS10YWItYmFyLicpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJHRhcmdldE1lbnUgPSAkKGAjJHt0YXJnZXRJRH1gKTtcclxuICAgIHRoaXMuJHRvZ2dsZXIgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXRvZ2dsZV0nKTtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCB0aGlzLm9wdGlvbnMsIHRoaXMuJHRhcmdldE1lbnUuZGF0YSgpKTtcclxuXHJcbiAgICAvLyBJZiB0aGV5IHdlcmUgc2V0LCBwYXJzZSB0aGUgYW5pbWF0aW9uIGNsYXNzZXNcclxuICAgIGlmKHRoaXMub3B0aW9ucy5hbmltYXRlKSB7XHJcbiAgICAgIGxldCBpbnB1dCA9IHRoaXMub3B0aW9ucy5hbmltYXRlLnNwbGl0KCcgJyk7XHJcblxyXG4gICAgICB0aGlzLmFuaW1hdGlvbkluID0gaW5wdXRbMF07XHJcbiAgICAgIHRoaXMuYW5pbWF0aW9uT3V0ID0gaW5wdXRbMV0gfHwgbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl91cGRhdGUoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgbmVjZXNzYXJ5IGV2ZW50IGhhbmRsZXJzIGZvciB0aGUgdGFiIGJhciB0byB3b3JrLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy5fdXBkYXRlTXFIYW5kbGVyID0gdGhpcy5fdXBkYXRlLmJpbmQodGhpcyk7XHJcblxyXG4gICAgJCh3aW5kb3cpLm9uKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCB0aGlzLl91cGRhdGVNcUhhbmRsZXIpO1xyXG5cclxuICAgIHRoaXMuJHRvZ2dsZXIub24oJ2NsaWNrLnpmLnJlc3BvbnNpdmVUb2dnbGUnLCB0aGlzLnRvZ2dsZU1lbnUuYmluZCh0aGlzKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgdGhlIGN1cnJlbnQgbWVkaWEgcXVlcnkgdG8gZGV0ZXJtaW5lIGlmIHRoZSB0YWIgYmFyIHNob3VsZCBiZSB2aXNpYmxlIG9yIGhpZGRlbi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF91cGRhdGUoKSB7XHJcbiAgICAvLyBNb2JpbGVcclxuICAgIGlmICghRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmF0TGVhc3QodGhpcy5vcHRpb25zLmhpZGVGb3IpKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuc2hvdygpO1xyXG4gICAgICB0aGlzLiR0YXJnZXRNZW51LmhpZGUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBEZXNrdG9wXHJcbiAgICBlbHNlIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5oaWRlKCk7XHJcbiAgICAgIHRoaXMuJHRhcmdldE1lbnUuc2hvdygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyB0aGUgZWxlbWVudCBhdHRhY2hlZCB0byB0aGUgdGFiIGJhci4gVGhlIHRvZ2dsZSBvbmx5IGhhcHBlbnMgaWYgdGhlIHNjcmVlbiBpcyBzbWFsbCBlbm91Z2ggdG8gYWxsb3cgaXQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIFJlc3BvbnNpdmVUb2dnbGUjdG9nZ2xlZFxyXG4gICAqL1xyXG4gIHRvZ2dsZU1lbnUoKSB7XHJcbiAgICBpZiAoIUZvdW5kYXRpb24uTWVkaWFRdWVyeS5hdExlYXN0KHRoaXMub3B0aW9ucy5oaWRlRm9yKSkge1xyXG4gICAgICBpZih0aGlzLm9wdGlvbnMuYW5pbWF0ZSkge1xyXG4gICAgICAgIGlmICh0aGlzLiR0YXJnZXRNZW51LmlzKCc6aGlkZGVuJykpIHtcclxuICAgICAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVJbih0aGlzLiR0YXJnZXRNZW51LCB0aGlzLmFuaW1hdGlvbkluLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBlbGVtZW50IGF0dGFjaGVkIHRvIHRoZSB0YWIgYmFyIHRvZ2dsZXMuXHJcbiAgICAgICAgICAgICAqIEBldmVudCBSZXNwb25zaXZlVG9nZ2xlI3RvZ2dsZWRcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigndG9nZ2xlZC56Zi5yZXNwb25zaXZlVG9nZ2xlJyk7XHJcbiAgICAgICAgICAgIHRoaXMuJHRhcmdldE1lbnUuZmluZCgnW2RhdGEtbXV0YXRlXScpLnRyaWdnZXJIYW5kbGVyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJyk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlT3V0KHRoaXMuJHRhcmdldE1lbnUsIHRoaXMuYW5pbWF0aW9uT3V0LCAoKSA9PiB7XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBlbGVtZW50IGF0dGFjaGVkIHRvIHRoZSB0YWIgYmFyIHRvZ2dsZXMuXHJcbiAgICAgICAgICAgICAqIEBldmVudCBSZXNwb25zaXZlVG9nZ2xlI3RvZ2dsZWRcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigndG9nZ2xlZC56Zi5yZXNwb25zaXZlVG9nZ2xlJyk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgdGhpcy4kdGFyZ2V0TWVudS50b2dnbGUoMCk7XHJcbiAgICAgICAgdGhpcy4kdGFyZ2V0TWVudS5maW5kKCdbZGF0YS1tdXRhdGVdJykudHJpZ2dlcignbXV0YXRlbWUuemYudHJpZ2dlcicpO1xyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBlbGVtZW50IGF0dGFjaGVkIHRvIHRoZSB0YWIgYmFyIHRvZ2dsZXMuXHJcbiAgICAgICAgICogQGV2ZW50IFJlc3BvbnNpdmVUb2dnbGUjdG9nZ2xlZFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigndG9nZ2xlZC56Zi5yZXNwb25zaXZlVG9nZ2xlJyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG5cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi5yZXNwb25zaXZlVG9nZ2xlJyk7XHJcbiAgICB0aGlzLiR0b2dnbGVyLm9mZignLnpmLnJlc3BvbnNpdmVUb2dnbGUnKTtcclxuXHJcbiAgICAkKHdpbmRvdykub2ZmKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCB0aGlzLl91cGRhdGVNcUhhbmRsZXIpO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcblJlc3BvbnNpdmVUb2dnbGUuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogVGhlIGJyZWFrcG9pbnQgYWZ0ZXIgd2hpY2ggdGhlIG1lbnUgaXMgYWx3YXlzIHNob3duLCBhbmQgdGhlIHRhYiBiYXIgaXMgaGlkZGVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnbWVkaXVtJ1xyXG4gICAqL1xyXG4gIGhpZGVGb3I6ICdtZWRpdW0nLFxyXG5cclxuICAvKipcclxuICAgKiBUbyBkZWNpZGUgaWYgdGhlIHRvZ2dsZSBzaG91bGQgYmUgYW5pbWF0ZWQgb3Igbm90LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGFuaW1hdGU6IGZhbHNlXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihSZXNwb25zaXZlVG9nZ2xlLCAnUmVzcG9uc2l2ZVRvZ2dsZScpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFJldmVhbCBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5yZXZlYWxcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmJveFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvbiBpZiB1c2luZyBhbmltYXRpb25zXHJcbiAqL1xyXG5cclxuY2xhc3MgUmV2ZWFsIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIFJldmVhbC5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gdXNlIGZvciB0aGUgbW9kYWwuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBvcHRpb25hbCBwYXJhbWV0ZXJzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIFJldmVhbC5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1JldmVhbCcpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignUmV2ZWFsJywge1xyXG4gICAgICAnRU5URVInOiAnb3BlbicsXHJcbiAgICAgICdTUEFDRSc6ICdvcGVuJyxcclxuICAgICAgJ0VTQ0FQRSc6ICdjbG9zZScsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBtb2RhbCBieSBhZGRpbmcgdGhlIG92ZXJsYXkgYW5kIGNsb3NlIGJ1dHRvbnMsIChpZiBzZWxlY3RlZCkuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHRoaXMuaWQgPSB0aGlzLiRlbGVtZW50LmF0dHIoJ2lkJyk7XHJcbiAgICB0aGlzLmlzQWN0aXZlID0gZmFsc2U7XHJcbiAgICB0aGlzLmNhY2hlZCA9IHttcTogRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmN1cnJlbnR9O1xyXG4gICAgdGhpcy5pc01vYmlsZSA9IG1vYmlsZVNuaWZmKCk7XHJcblxyXG4gICAgdGhpcy4kYW5jaG9yID0gJChgW2RhdGEtb3Blbj1cIiR7dGhpcy5pZH1cIl1gKS5sZW5ndGggPyAkKGBbZGF0YS1vcGVuPVwiJHt0aGlzLmlkfVwiXWApIDogJChgW2RhdGEtdG9nZ2xlPVwiJHt0aGlzLmlkfVwiXWApO1xyXG4gICAgdGhpcy4kYW5jaG9yLmF0dHIoe1xyXG4gICAgICAnYXJpYS1jb250cm9scyc6IHRoaXMuaWQsXHJcbiAgICAgICdhcmlhLWhhc3BvcHVwJzogdHJ1ZSxcclxuICAgICAgJ3RhYmluZGV4JzogMFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5mdWxsU2NyZWVuIHx8IHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2Z1bGwnKSkge1xyXG4gICAgICB0aGlzLm9wdGlvbnMuZnVsbFNjcmVlbiA9IHRydWU7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5vdmVybGF5ID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJsYXkgJiYgIXRoaXMuJG92ZXJsYXkpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheSA9IHRoaXMuX21ha2VPdmVybGF5KHRoaXMuaWQpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cih7XHJcbiAgICAgICAgJ3JvbGUnOiAnZGlhbG9nJyxcclxuICAgICAgICAnYXJpYS1oaWRkZW4nOiB0cnVlLFxyXG4gICAgICAgICdkYXRhLXlldGktYm94JzogdGhpcy5pZCxcclxuICAgICAgICAnZGF0YS1yZXNpemUnOiB0aGlzLmlkXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZih0aGlzLiRvdmVybGF5KSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuZGV0YWNoKCkuYXBwZW5kVG8odGhpcy4kb3ZlcmxheSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmRldGFjaCgpLmFwcGVuZFRvKCQodGhpcy5vcHRpb25zLmFwcGVuZFRvKSk7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3MoJ3dpdGhvdXQtb3ZlcmxheScpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmRlZXBMaW5rICYmIHdpbmRvdy5sb2NhdGlvbi5oYXNoID09PSAoIGAjJHt0aGlzLmlkfWApKSB7XHJcbiAgICAgICQod2luZG93KS5vbmUoJ2xvYWQuemYucmV2ZWFsJywgdGhpcy5vcGVuLmJpbmQodGhpcykpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhbiBvdmVybGF5IGRpdiB0byBkaXNwbGF5IGJlaGluZCB0aGUgbW9kYWwuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfbWFrZU92ZXJsYXkoKSB7XHJcbiAgICByZXR1cm4gJCgnPGRpdj48L2Rpdj4nKVxyXG4gICAgICAuYWRkQ2xhc3MoJ3JldmVhbC1vdmVybGF5JylcclxuICAgICAgLmFwcGVuZFRvKHRoaXMub3B0aW9ucy5hcHBlbmRUbyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGVzIHBvc2l0aW9uIG9mIG1vZGFsXHJcbiAgICogVE9ETzogIEZpZ3VyZSBvdXQgaWYgd2UgYWN0dWFsbHkgbmVlZCB0byBjYWNoZSB0aGVzZSB2YWx1ZXMgb3IgaWYgaXQgZG9lc24ndCBtYXR0ZXJcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF91cGRhdGVQb3NpdGlvbigpIHtcclxuICAgIHZhciB3aWR0aCA9IHRoaXMuJGVsZW1lbnQub3V0ZXJXaWR0aCgpO1xyXG4gICAgdmFyIG91dGVyV2lkdGggPSAkKHdpbmRvdykud2lkdGgoKTtcclxuICAgIHZhciBoZWlnaHQgPSB0aGlzLiRlbGVtZW50Lm91dGVySGVpZ2h0KCk7XHJcbiAgICB2YXIgb3V0ZXJIZWlnaHQgPSAkKHdpbmRvdykuaGVpZ2h0KCk7XHJcbiAgICB2YXIgbGVmdCwgdG9wO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5oT2Zmc2V0ID09PSAnYXV0bycpIHtcclxuICAgICAgbGVmdCA9IHBhcnNlSW50KChvdXRlcldpZHRoIC0gd2lkdGgpIC8gMiwgMTApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbGVmdCA9IHBhcnNlSW50KHRoaXMub3B0aW9ucy5oT2Zmc2V0LCAxMCk7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnZPZmZzZXQgPT09ICdhdXRvJykge1xyXG4gICAgICBpZiAoaGVpZ2h0ID4gb3V0ZXJIZWlnaHQpIHtcclxuICAgICAgICB0b3AgPSBwYXJzZUludChNYXRoLm1pbigxMDAsIG91dGVySGVpZ2h0IC8gMTApLCAxMCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdG9wID0gcGFyc2VJbnQoKG91dGVySGVpZ2h0IC0gaGVpZ2h0KSAvIDQsIDEwKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdG9wID0gcGFyc2VJbnQodGhpcy5vcHRpb25zLnZPZmZzZXQsIDEwKTtcclxuICAgIH1cclxuICAgIHRoaXMuJGVsZW1lbnQuY3NzKHt0b3A6IHRvcCArICdweCd9KTtcclxuICAgIC8vIG9ubHkgd29ycnkgYWJvdXQgbGVmdCBpZiB3ZSBkb24ndCBoYXZlIGFuIG92ZXJsYXkgb3Igd2UgaGF2ZWEgIGhvcml6b250YWwgb2Zmc2V0LFxyXG4gICAgLy8gb3RoZXJ3aXNlIHdlJ3JlIHBlcmZlY3RseSBpbiB0aGUgbWlkZGxlXHJcbiAgICBpZighdGhpcy4kb3ZlcmxheSB8fCAodGhpcy5vcHRpb25zLmhPZmZzZXQgIT09ICdhdXRvJykpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5jc3Moe2xlZnQ6IGxlZnQgKyAncHgnfSk7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuY3NzKHttYXJnaW46ICcwcHgnfSk7XHJcbiAgICB9XHJcblxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyBmb3IgdGhlIG1vZGFsLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vbih7XHJcbiAgICAgICdvcGVuLnpmLnRyaWdnZXInOiB0aGlzLm9wZW4uYmluZCh0aGlzKSxcclxuICAgICAgJ2Nsb3NlLnpmLnRyaWdnZXInOiAoZXZlbnQsICRlbGVtZW50KSA9PiB7XHJcbiAgICAgICAgaWYgKChldmVudC50YXJnZXQgPT09IF90aGlzLiRlbGVtZW50WzBdKSB8fFxyXG4gICAgICAgICAgICAoJChldmVudC50YXJnZXQpLnBhcmVudHMoJ1tkYXRhLWNsb3NhYmxlXScpWzBdID09PSAkZWxlbWVudCkpIHsgLy8gb25seSBjbG9zZSByZXZlYWwgd2hlbiBpdCdzIGV4cGxpY2l0bHkgY2FsbGVkXHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5jbG9zZS5hcHBseSh0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgICd0b2dnbGUuemYudHJpZ2dlcic6IHRoaXMudG9nZ2xlLmJpbmQodGhpcyksXHJcbiAgICAgICdyZXNpemVtZS56Zi50cmlnZ2VyJzogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMuX3VwZGF0ZVBvc2l0aW9uKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGlmICh0aGlzLiRhbmNob3IubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXMuJGFuY2hvci5vbigna2V5ZG93bi56Zi5yZXZlYWwnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUud2hpY2ggPT09IDEzIHx8IGUud2hpY2ggPT09IDMyKSB7XHJcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgX3RoaXMub3BlbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgJiYgdGhpcy5vcHRpb25zLm92ZXJsYXkpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheS5vZmYoJy56Zi5yZXZlYWwnKS5vbignY2xpY2suemYucmV2ZWFsJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmIChlLnRhcmdldCA9PT0gX3RoaXMuJGVsZW1lbnRbMF0gfHxcclxuICAgICAgICAgICQuY29udGFpbnMoX3RoaXMuJGVsZW1lbnRbMF0sIGUudGFyZ2V0KSB8fFxyXG4gICAgICAgICAgICAhJC5jb250YWlucyhkb2N1bWVudCwgZS50YXJnZXQpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGVlcExpbmspIHtcclxuICAgICAgJCh3aW5kb3cpLm9uKGBwb3BzdGF0ZS56Zi5yZXZlYWw6JHt0aGlzLmlkfWAsIHRoaXMuX2hhbmRsZVN0YXRlLmJpbmQodGhpcykpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlcyBtb2RhbCBtZXRob2RzIG9uIGJhY2svZm9yd2FyZCBidXR0b24gY2xpY2tzIG9yIGFueSBvdGhlciBldmVudCB0aGF0IHRyaWdnZXJzIHBvcHN0YXRlLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2hhbmRsZVN0YXRlKGUpIHtcclxuICAgIGlmKHdpbmRvdy5sb2NhdGlvbi5oYXNoID09PSAoICcjJyArIHRoaXMuaWQpICYmICF0aGlzLmlzQWN0aXZlKXsgdGhpcy5vcGVuKCk7IH1cclxuICAgIGVsc2V7IHRoaXMuY2xvc2UoKTsgfVxyXG4gIH1cclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIHRoZSBtb2RhbCBjb250cm9sbGVkIGJ5IGB0aGlzLiRhbmNob3JgLCBhbmQgY2xvc2VzIGFsbCBvdGhlcnMgYnkgZGVmYXVsdC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgUmV2ZWFsI2Nsb3NlbWVcclxuICAgKiBAZmlyZXMgUmV2ZWFsI29wZW5cclxuICAgKi9cclxuICBvcGVuKCkge1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kZWVwTGluaykge1xyXG4gICAgICB2YXIgaGFzaCA9IGAjJHt0aGlzLmlkfWA7XHJcblxyXG4gICAgICBpZiAod2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKSB7XHJcbiAgICAgICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKG51bGwsIG51bGwsIGhhc2gpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gaGFzaDtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaXNBY3RpdmUgPSB0cnVlO1xyXG5cclxuICAgIC8vIE1ha2UgZWxlbWVudHMgaW52aXNpYmxlLCBidXQgcmVtb3ZlIGRpc3BsYXk6IG5vbmUgc28gd2UgY2FuIGdldCBzaXplIGFuZCBwb3NpdGlvbmluZ1xyXG4gICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAgIC5jc3MoeyAndmlzaWJpbGl0eSc6ICdoaWRkZW4nIH0pXHJcbiAgICAgICAgLnNob3coKVxyXG4gICAgICAgIC5zY3JvbGxUb3AoMCk7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJsYXkpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheS5jc3Moeyd2aXNpYmlsaXR5JzogJ2hpZGRlbid9KS5zaG93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fdXBkYXRlUG9zaXRpb24oKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5oaWRlKClcclxuICAgICAgLmNzcyh7ICd2aXNpYmlsaXR5JzogJycgfSk7XHJcblxyXG4gICAgaWYodGhpcy4kb3ZlcmxheSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5LmNzcyh7J3Zpc2liaWxpdHknOiAnJ30pLmhpZGUoKTtcclxuICAgICAgaWYodGhpcy4kZWxlbWVudC5oYXNDbGFzcygnZmFzdCcpKSB7XHJcbiAgICAgICAgdGhpcy4kb3ZlcmxheS5hZGRDbGFzcygnZmFzdCcpO1xyXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ3Nsb3cnKSkge1xyXG4gICAgICAgIHRoaXMuJG92ZXJsYXkuYWRkQ2xhc3MoJ3Nsb3cnKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5tdWx0aXBsZU9wZW5lZCkge1xyXG4gICAgICAvKipcclxuICAgICAgICogRmlyZXMgaW1tZWRpYXRlbHkgYmVmb3JlIHRoZSBtb2RhbCBvcGVucy5cclxuICAgICAgICogQ2xvc2VzIGFueSBvdGhlciBtb2RhbHMgdGhhdCBhcmUgY3VycmVudGx5IG9wZW5cclxuICAgICAgICogQGV2ZW50IFJldmVhbCNjbG9zZW1lXHJcbiAgICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2Nsb3NlbWUuemYucmV2ZWFsJywgdGhpcy5pZCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBmdW5jdGlvbiBhZGRSZXZlYWxPcGVuQ2xhc3NlcygpIHtcclxuICAgICAgaWYgKF90aGlzLmlzTW9iaWxlKSB7XHJcbiAgICAgICAgaWYoIV90aGlzLm9yaWdpbmFsU2Nyb2xsUG9zKSB7XHJcbiAgICAgICAgICBfdGhpcy5vcmlnaW5hbFNjcm9sbFBvcyA9IHdpbmRvdy5wYWdlWU9mZnNldDtcclxuICAgICAgICB9XHJcbiAgICAgICAgJCgnaHRtbCwgYm9keScpLmFkZENsYXNzKCdpcy1yZXZlYWwtb3BlbicpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgICQoJ2JvZHknKS5hZGRDbGFzcygnaXMtcmV2ZWFsLW9wZW4nKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gTW90aW9uIFVJIG1ldGhvZCBvZiByZXZlYWxcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYW5pbWF0aW9uSW4pIHtcclxuICAgICAgZnVuY3Rpb24gYWZ0ZXJBbmltYXRpb24oKXtcclxuICAgICAgICBfdGhpcy4kZWxlbWVudFxyXG4gICAgICAgICAgLmF0dHIoe1xyXG4gICAgICAgICAgICAnYXJpYS1oaWRkZW4nOiBmYWxzZSxcclxuICAgICAgICAgICAgJ3RhYmluZGV4JzogLTFcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuZm9jdXMoKTtcclxuICAgICAgICBhZGRSZXZlYWxPcGVuQ2xhc3NlcygpO1xyXG4gICAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQudHJhcEZvY3VzKF90aGlzLiRlbGVtZW50KTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJsYXkpIHtcclxuICAgICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlSW4odGhpcy4kb3ZlcmxheSwgJ2ZhZGUtaW4nKTtcclxuICAgICAgfVxyXG4gICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlSW4odGhpcy4kZWxlbWVudCwgdGhpcy5vcHRpb25zLmFuaW1hdGlvbkluLCAoKSA9PiB7XHJcbiAgICAgICAgaWYodGhpcy4kZWxlbWVudCkgeyAvLyBwcm90ZWN0IGFnYWluc3Qgb2JqZWN0IGhhdmluZyBiZWVuIHJlbW92ZWRcclxuICAgICAgICAgIHRoaXMuZm9jdXNhYmxlRWxlbWVudHMgPSBGb3VuZGF0aW9uLktleWJvYXJkLmZpbmRGb2N1c2FibGUodGhpcy4kZWxlbWVudCk7XHJcbiAgICAgICAgICBhZnRlckFuaW1hdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvLyBqUXVlcnkgbWV0aG9kIG9mIHJldmVhbFxyXG4gICAgZWxzZSB7XHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub3ZlcmxheSkge1xyXG4gICAgICAgIHRoaXMuJG92ZXJsYXkuc2hvdygwKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLiRlbGVtZW50LnNob3codGhpcy5vcHRpb25zLnNob3dEZWxheSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaGFuZGxlIGFjY2Vzc2liaWxpdHlcclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLmF0dHIoe1xyXG4gICAgICAgICdhcmlhLWhpZGRlbic6IGZhbHNlLFxyXG4gICAgICAgICd0YWJpbmRleCc6IC0xXHJcbiAgICAgIH0pXHJcbiAgICAgIC5mb2N1cygpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC50cmFwRm9jdXModGhpcy4kZWxlbWVudCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBtb2RhbCBoYXMgc3VjY2Vzc2Z1bGx5IG9wZW5lZC5cclxuICAgICAqIEBldmVudCBSZXZlYWwjb3BlblxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ29wZW4uemYucmV2ZWFsJyk7XHJcblxyXG4gICAgYWRkUmV2ZWFsT3BlbkNsYXNzZXMoKTtcclxuXHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgdGhpcy5fZXh0cmFIYW5kbGVycygpO1xyXG4gICAgfSwgMCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV4dHJhIGV2ZW50IGhhbmRsZXJzIGZvciB0aGUgYm9keSBhbmQgd2luZG93IGlmIG5lY2Vzc2FyeS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9leHRyYUhhbmRsZXJzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIGlmKCF0aGlzLiRlbGVtZW50KSB7IHJldHVybjsgfSAvLyBJZiB3ZSdyZSBpbiB0aGUgbWlkZGxlIG9mIGNsZWFudXAsIGRvbid0IGZyZWFrIG91dFxyXG4gICAgdGhpcy5mb2N1c2FibGVFbGVtZW50cyA9IEZvdW5kYXRpb24uS2V5Ym9hcmQuZmluZEZvY3VzYWJsZSh0aGlzLiRlbGVtZW50KTtcclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5vdmVybGF5ICYmIHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgJiYgIXRoaXMub3B0aW9ucy5mdWxsU2NyZWVuKSB7XHJcbiAgICAgICQoJ2JvZHknKS5vbignY2xpY2suemYucmV2ZWFsJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmIChlLnRhcmdldCA9PT0gX3RoaXMuJGVsZW1lbnRbMF0gfHxcclxuICAgICAgICAgICQuY29udGFpbnMoX3RoaXMuJGVsZW1lbnRbMF0sIGUudGFyZ2V0KSB8fFxyXG4gICAgICAgICAgICAhJC5jb250YWlucyhkb2N1bWVudCwgZS50YXJnZXQpKSB7IHJldHVybjsgfVxyXG4gICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbkVzYykge1xyXG4gICAgICAkKHdpbmRvdykub24oJ2tleWRvd24uemYucmV2ZWFsJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdSZXZlYWwnLCB7XHJcbiAgICAgICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmIChfdGhpcy5vcHRpb25zLmNsb3NlT25Fc2MpIHtcclxuICAgICAgICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgICAgICAgIF90aGlzLiRhbmNob3IuZm9jdXMoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBsb2NrIGZvY3VzIHdpdGhpbiBtb2RhbCB3aGlsZSB0YWJiaW5nXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uKCdrZXlkb3duLnpmLnJldmVhbCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgdmFyICR0YXJnZXQgPSAkKHRoaXMpO1xyXG4gICAgICAvLyBoYW5kbGUga2V5Ym9hcmQgZXZlbnQgd2l0aCBrZXlib2FyZCB1dGlsXHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdSZXZlYWwnLCB7XHJcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoX3RoaXMuJGVsZW1lbnQuZmluZCgnOmZvY3VzJykuaXMoX3RoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtY2xvc2VdJykpKSB7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IC8vIHNldCBmb2N1cyBiYWNrIHRvIGFuY2hvciBpZiBjbG9zZSBidXR0b24gaGFzIGJlZW4gYWN0aXZhdGVkXHJcbiAgICAgICAgICAgICAgX3RoaXMuJGFuY2hvci5mb2N1cygpO1xyXG4gICAgICAgICAgICB9LCAxKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoJHRhcmdldC5pcyhfdGhpcy5mb2N1c2FibGVFbGVtZW50cykpIHsgLy8gZG9udCd0IHRyaWdnZXIgaWYgYWN1YWwgZWxlbWVudCBoYXMgZm9jdXMgKGkuZS4gaW5wdXRzLCBsaW5rcywgLi4uKVxyXG4gICAgICAgICAgICBfdGhpcy5vcGVuKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjbG9zZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5jbG9zZU9uRXNjKSB7XHJcbiAgICAgICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgICAgIF90aGlzLiRhbmNob3IuZm9jdXMoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKHByZXZlbnREZWZhdWx0KSB7XHJcbiAgICAgICAgICBpZiAocHJldmVudERlZmF1bHQpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb3NlcyB0aGUgbW9kYWwuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIFJldmVhbCNjbG9zZWRcclxuICAgKi9cclxuICBjbG9zZSgpIHtcclxuICAgIGlmICghdGhpcy5pc0FjdGl2ZSB8fCAhdGhpcy4kZWxlbWVudC5pcygnOnZpc2libGUnKSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIC8vIE1vdGlvbiBVSSBtZXRob2Qgb2YgaGlkaW5nXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmFuaW1hdGlvbk91dCkge1xyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJsYXkpIHtcclxuICAgICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlT3V0KHRoaXMuJG92ZXJsYXksICdmYWRlLW91dCcsIGZpbmlzaFVwKTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICBmaW5pc2hVcCgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlT3V0KHRoaXMuJGVsZW1lbnQsIHRoaXMub3B0aW9ucy5hbmltYXRpb25PdXQpO1xyXG4gICAgfVxyXG4gICAgLy8galF1ZXJ5IG1ldGhvZCBvZiBoaWRpbmdcclxuICAgIGVsc2Uge1xyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJsYXkpIHtcclxuICAgICAgICB0aGlzLiRvdmVybGF5LmhpZGUoMCwgZmluaXNoVXApO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIGZpbmlzaFVwKCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuaGlkZSh0aGlzLm9wdGlvbnMuaGlkZURlbGF5KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDb25kaXRpb25hbHMgdG8gcmVtb3ZlIGV4dHJhIGV2ZW50IGxpc3RlbmVycyBhZGRlZCBvbiBvcGVuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25Fc2MpIHtcclxuICAgICAgJCh3aW5kb3cpLm9mZigna2V5ZG93bi56Zi5yZXZlYWwnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5vdmVybGF5ICYmIHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2spIHtcclxuICAgICAgJCgnYm9keScpLm9mZignY2xpY2suemYucmV2ZWFsJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJ2tleWRvd24uemYucmV2ZWFsJyk7XHJcblxyXG4gICAgZnVuY3Rpb24gZmluaXNoVXAoKSB7XHJcbiAgICAgIGlmIChfdGhpcy5pc01vYmlsZSkge1xyXG4gICAgICAgICQoJ2h0bWwsIGJvZHknKS5yZW1vdmVDbGFzcygnaXMtcmV2ZWFsLW9wZW4nKTtcclxuICAgICAgICBpZihfdGhpcy5vcmlnaW5hbFNjcm9sbFBvcykge1xyXG4gICAgICAgICAgJCgnYm9keScpLnNjcm9sbFRvcChfdGhpcy5vcmlnaW5hbFNjcm9sbFBvcyk7XHJcbiAgICAgICAgICBfdGhpcy5vcmlnaW5hbFNjcm9sbFBvcyA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgICQoJ2JvZHknKS5yZW1vdmVDbGFzcygnaXMtcmV2ZWFsLW9wZW4nKTtcclxuICAgICAgfVxyXG5cclxuXHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVsZWFzZUZvY3VzKF90aGlzLiRlbGVtZW50KTtcclxuXHJcbiAgICAgIF90aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgdHJ1ZSk7XHJcblxyXG4gICAgICAvKipcclxuICAgICAgKiBGaXJlcyB3aGVuIHRoZSBtb2RhbCBpcyBkb25lIGNsb3NpbmcuXHJcbiAgICAgICogQGV2ZW50IFJldmVhbCNjbG9zZWRcclxuICAgICAgKi9cclxuICAgICAgX3RoaXMuJGVsZW1lbnQudHJpZ2dlcignY2xvc2VkLnpmLnJldmVhbCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgKiBSZXNldHMgdGhlIG1vZGFsIGNvbnRlbnRcclxuICAgICogVGhpcyBwcmV2ZW50cyBhIHJ1bm5pbmcgdmlkZW8gdG8ga2VlcCBnb2luZyBpbiB0aGUgYmFja2dyb3VuZFxyXG4gICAgKi9cclxuICAgIGlmICh0aGlzLm9wdGlvbnMucmVzZXRPbkNsb3NlKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuaHRtbCh0aGlzLiRlbGVtZW50Lmh0bWwoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5pc0FjdGl2ZSA9IGZhbHNlO1xyXG4gICAgIGlmIChfdGhpcy5vcHRpb25zLmRlZXBMaW5rKSB7XHJcbiAgICAgICBpZiAod2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKSB7XHJcbiAgICAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSgnJywgZG9jdW1lbnQudGl0bGUsIHdpbmRvdy5sb2NhdGlvbi5ocmVmLnJlcGxhY2UoYCMke3RoaXMuaWR9YCwgJycpKTtcclxuICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gJyc7XHJcbiAgICAgICB9XHJcbiAgICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyB0aGUgb3Blbi9jbG9zZWQgc3RhdGUgb2YgYSBtb2RhbC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICB0b2dnbGUoKSB7XHJcbiAgICBpZiAodGhpcy5pc0FjdGl2ZSkge1xyXG4gICAgICB0aGlzLmNsb3NlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm9wZW4oKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBhIG1vZGFsLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJsYXkpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hcHBlbmRUbygkKHRoaXMub3B0aW9ucy5hcHBlbmRUbykpOyAvLyBtb3ZlICRlbGVtZW50IG91dHNpZGUgb2YgJG92ZXJsYXkgdG8gcHJldmVudCBlcnJvciB1bnJlZ2lzdGVyUGx1Z2luKClcclxuICAgICAgdGhpcy4kb3ZlcmxheS5oaWRlKCkub2ZmKCkucmVtb3ZlKCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLiRlbGVtZW50LmhpZGUoKS5vZmYoKTtcclxuICAgIHRoaXMuJGFuY2hvci5vZmYoJy56ZicpO1xyXG4gICAgJCh3aW5kb3cpLm9mZihgLnpmLnJldmVhbDoke3RoaXMuaWR9YCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH07XHJcbn1cclxuXHJcblJldmVhbC5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBNb3Rpb24tVUkgY2xhc3MgdG8gdXNlIGZvciBhbmltYXRlZCBlbGVtZW50cy4gSWYgbm9uZSB1c2VkLCBkZWZhdWx0cyB0byBzaW1wbGUgc2hvdy9oaWRlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnc2xpZGUtaW4tbGVmdCdcclxuICAgKi9cclxuICBhbmltYXRpb25JbjogJycsXHJcbiAgLyoqXHJcbiAgICogTW90aW9uLVVJIGNsYXNzIHRvIHVzZSBmb3IgYW5pbWF0ZWQgZWxlbWVudHMuIElmIG5vbmUgdXNlZCwgZGVmYXVsdHMgdG8gc2ltcGxlIHNob3cvaGlkZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3NsaWRlLW91dC1yaWdodCdcclxuICAgKi9cclxuICBhbmltYXRpb25PdXQ6ICcnLFxyXG4gIC8qKlxyXG4gICAqIFRpbWUsIGluIG1zLCB0byBkZWxheSB0aGUgb3BlbmluZyBvZiBhIG1vZGFsIGFmdGVyIGEgY2xpY2sgaWYgbm8gYW5pbWF0aW9uIHVzZWQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEwXHJcbiAgICovXHJcbiAgc2hvd0RlbGF5OiAwLFxyXG4gIC8qKlxyXG4gICAqIFRpbWUsIGluIG1zLCB0byBkZWxheSB0aGUgY2xvc2luZyBvZiBhIG1vZGFsIGFmdGVyIGEgY2xpY2sgaWYgbm8gYW5pbWF0aW9uIHVzZWQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEwXHJcbiAgICovXHJcbiAgaGlkZURlbGF5OiAwLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyBhIGNsaWNrIG9uIHRoZSBib2R5L292ZXJsYXkgdG8gY2xvc2UgdGhlIG1vZGFsLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xvc2VPbkNsaWNrOiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgbW9kYWwgdG8gY2xvc2UgaWYgdGhlIHVzZXIgcHJlc3NlcyB0aGUgYEVTQ0FQRWAga2V5LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xvc2VPbkVzYzogdHJ1ZSxcclxuICAvKipcclxuICAgKiBJZiB0cnVlLCBhbGxvd3MgbXVsdGlwbGUgbW9kYWxzIHRvIGJlIGRpc3BsYXllZCBhdCBvbmNlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIG11bHRpcGxlT3BlbmVkOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBEaXN0YW5jZSwgaW4gcGl4ZWxzLCB0aGUgbW9kYWwgc2hvdWxkIHB1c2ggZG93biBmcm9tIHRoZSB0b3Agb2YgdGhlIHNjcmVlbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgYXV0b1xyXG4gICAqL1xyXG4gIHZPZmZzZXQ6ICdhdXRvJyxcclxuICAvKipcclxuICAgKiBEaXN0YW5jZSwgaW4gcGl4ZWxzLCB0aGUgbW9kYWwgc2hvdWxkIHB1c2ggaW4gZnJvbSB0aGUgc2lkZSBvZiB0aGUgc2NyZWVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBhdXRvXHJcbiAgICovXHJcbiAgaE9mZnNldDogJ2F1dG8nLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgbW9kYWwgdG8gYmUgZnVsbHNjcmVlbiwgY29tcGxldGVseSBibG9ja2luZyBvdXQgdGhlIHJlc3Qgb2YgdGhlIHZpZXcuIEpTIGNoZWNrcyBmb3IgdGhpcyBhcyB3ZWxsLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGZ1bGxTY3JlZW46IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIFBlcmNlbnRhZ2Ugb2Ygc2NyZWVuIGhlaWdodCB0aGUgbW9kYWwgc2hvdWxkIHB1c2ggdXAgZnJvbSB0aGUgYm90dG9tIG9mIHRoZSB2aWV3LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMFxyXG4gICAqL1xyXG4gIGJ0bU9mZnNldFBjdDogMTAsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBtb2RhbCB0byBnZW5lcmF0ZSBhbiBvdmVybGF5IGRpdiwgd2hpY2ggd2lsbCBjb3ZlciB0aGUgdmlldyB3aGVuIG1vZGFsIG9wZW5zLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgb3ZlcmxheTogdHJ1ZSxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIG1vZGFsIHRvIHJlbW92ZSBhbmQgcmVpbmplY3QgbWFya3VwIG9uIGNsb3NlLiBTaG91bGQgYmUgdHJ1ZSBpZiB1c2luZyB2aWRlbyBlbGVtZW50cyB3L28gdXNpbmcgcHJvdmlkZXIncyBhcGksIG90aGVyd2lzZSwgdmlkZW9zIHdpbGwgY29udGludWUgdG8gcGxheSBpbiB0aGUgYmFja2dyb3VuZC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICByZXNldE9uQ2xvc2U6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgbW9kYWwgdG8gYWx0ZXIgdGhlIHVybCBvbiBvcGVuL2Nsb3NlLCBhbmQgYWxsb3dzIHRoZSB1c2Ugb2YgdGhlIGBiYWNrYCBidXR0b24gdG8gY2xvc2UgbW9kYWxzLiBBTFNPLCBhbGxvd3MgYSBtb2RhbCB0byBhdXRvLW1hbmlhY2FsbHkgb3BlbiBvbiBwYWdlIGxvYWQgSUYgdGhlIGhhc2ggPT09IHRoZSBtb2RhbCdzIHVzZXItc2V0IGlkLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGRlZXBMaW5rOiBmYWxzZSxcclxuICAgIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgbW9kYWwgdG8gYXBwZW5kIHRvIGN1c3RvbSBkaXYuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYXBwZW5kVG86IFwiYm9keVwiXHJcblxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oUmV2ZWFsLCAnUmV2ZWFsJyk7XHJcblxyXG5mdW5jdGlvbiBpUGhvbmVTbmlmZigpIHtcclxuICByZXR1cm4gL2lQKGFkfGhvbmV8b2QpLipPUy8udGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFuZHJvaWRTbmlmZigpIHtcclxuICByZXR1cm4gL0FuZHJvaWQvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb2JpbGVTbmlmZigpIHtcclxuICByZXR1cm4gaVBob25lU25pZmYoKSB8fCBhbmRyb2lkU25pZmYoKTtcclxufVxyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFNsaWRlciBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5zbGlkZXJcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudG91Y2hcclxuICovXHJcblxyXG5jbGFzcyBTbGlkZXIge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYSBzbGlkZXIgY29udHJvbC5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGEgc2xpZGVyIGNvbnRyb2wuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIFNsaWRlci5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdTbGlkZXInKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ1NsaWRlcicsIHtcclxuICAgICAgJ2x0cic6IHtcclxuICAgICAgICAnQVJST1dfUklHSFQnOiAnaW5jcmVhc2UnLFxyXG4gICAgICAgICdBUlJPV19VUCc6ICdpbmNyZWFzZScsXHJcbiAgICAgICAgJ0FSUk9XX0RPV04nOiAnZGVjcmVhc2UnLFxyXG4gICAgICAgICdBUlJPV19MRUZUJzogJ2RlY3JlYXNlJyxcclxuICAgICAgICAnU0hJRlRfQVJST1dfUklHSFQnOiAnaW5jcmVhc2VfZmFzdCcsXHJcbiAgICAgICAgJ1NISUZUX0FSUk9XX1VQJzogJ2luY3JlYXNlX2Zhc3QnLFxyXG4gICAgICAgICdTSElGVF9BUlJPV19ET1dOJzogJ2RlY3JlYXNlX2Zhc3QnLFxyXG4gICAgICAgICdTSElGVF9BUlJPV19MRUZUJzogJ2RlY3JlYXNlX2Zhc3QnXHJcbiAgICAgIH0sXHJcbiAgICAgICdydGwnOiB7XHJcbiAgICAgICAgJ0FSUk9XX0xFRlQnOiAnaW5jcmVhc2UnLFxyXG4gICAgICAgICdBUlJPV19SSUdIVCc6ICdkZWNyZWFzZScsXHJcbiAgICAgICAgJ1NISUZUX0FSUk9XX0xFRlQnOiAnaW5jcmVhc2VfZmFzdCcsXHJcbiAgICAgICAgJ1NISUZUX0FSUk9XX1JJR0hUJzogJ2RlY3JlYXNlX2Zhc3QnXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlsaXplcyB0aGUgcGx1Z2luIGJ5IHJlYWRpbmcvc2V0dGluZyBhdHRyaWJ1dGVzLCBjcmVhdGluZyBjb2xsZWN0aW9ucyBhbmQgc2V0dGluZyB0aGUgaW5pdGlhbCBwb3NpdGlvbiBvZiB0aGUgaGFuZGxlKHMpLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB0aGlzLmlucHV0cyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnaW5wdXQnKTtcclxuICAgIHRoaXMuaGFuZGxlcyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtc2xpZGVyLWhhbmRsZV0nKTtcclxuXHJcbiAgICB0aGlzLiRoYW5kbGUgPSB0aGlzLmhhbmRsZXMuZXEoMCk7XHJcbiAgICB0aGlzLiRpbnB1dCA9IHRoaXMuaW5wdXRzLmxlbmd0aCA/IHRoaXMuaW5wdXRzLmVxKDApIDogJChgIyR7dGhpcy4kaGFuZGxlLmF0dHIoJ2FyaWEtY29udHJvbHMnKX1gKTtcclxuICAgIHRoaXMuJGZpbGwgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXNsaWRlci1maWxsXScpLmNzcyh0aGlzLm9wdGlvbnMudmVydGljYWwgPyAnaGVpZ2h0JyA6ICd3aWR0aCcsIDApO1xyXG5cclxuICAgIHZhciBpc0RibCA9IGZhbHNlLFxyXG4gICAgICAgIF90aGlzID0gdGhpcztcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGlzYWJsZWQgfHwgdGhpcy4kZWxlbWVudC5oYXNDbGFzcyh0aGlzLm9wdGlvbnMuZGlzYWJsZWRDbGFzcykpIHtcclxuICAgICAgdGhpcy5vcHRpb25zLmRpc2FibGVkID0gdHJ1ZTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuZGlzYWJsZWRDbGFzcyk7XHJcbiAgICB9XHJcbiAgICBpZiAoIXRoaXMuaW5wdXRzLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLmlucHV0cyA9ICQoKS5hZGQodGhpcy4kaW5wdXQpO1xyXG4gICAgICB0aGlzLm9wdGlvbnMuYmluZGluZyA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fc2V0SW5pdEF0dHIoMCk7XHJcblxyXG4gICAgaWYgKHRoaXMuaGFuZGxlc1sxXSkge1xyXG4gICAgICB0aGlzLm9wdGlvbnMuZG91YmxlU2lkZWQgPSB0cnVlO1xyXG4gICAgICB0aGlzLiRoYW5kbGUyID0gdGhpcy5oYW5kbGVzLmVxKDEpO1xyXG4gICAgICB0aGlzLiRpbnB1dDIgPSB0aGlzLmlucHV0cy5sZW5ndGggPiAxID8gdGhpcy5pbnB1dHMuZXEoMSkgOiAkKGAjJHt0aGlzLiRoYW5kbGUyLmF0dHIoJ2FyaWEtY29udHJvbHMnKX1gKTtcclxuXHJcbiAgICAgIGlmICghdGhpcy5pbnB1dHNbMV0pIHtcclxuICAgICAgICB0aGlzLmlucHV0cyA9IHRoaXMuaW5wdXRzLmFkZCh0aGlzLiRpbnB1dDIpO1xyXG4gICAgICB9XHJcbiAgICAgIGlzRGJsID0gdHJ1ZTtcclxuXHJcbiAgICAgIC8vIHRoaXMuJGhhbmRsZS50cmlnZ2VySGFuZGxlcignY2xpY2suemYuc2xpZGVyJyk7XHJcbiAgICAgIHRoaXMuX3NldEluaXRBdHRyKDEpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFNldCBoYW5kbGUgcG9zaXRpb25zXHJcbiAgICB0aGlzLnNldEhhbmRsZXMoKTtcclxuXHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIHNldEhhbmRsZXMoKSB7XHJcbiAgICBpZih0aGlzLmhhbmRsZXNbMV0pIHtcclxuICAgICAgdGhpcy5fc2V0SGFuZGxlUG9zKHRoaXMuJGhhbmRsZSwgdGhpcy5pbnB1dHMuZXEoMCkudmFsKCksIHRydWUsICgpID0+IHtcclxuICAgICAgICB0aGlzLl9zZXRIYW5kbGVQb3ModGhpcy4kaGFuZGxlMiwgdGhpcy5pbnB1dHMuZXEoMSkudmFsKCksIHRydWUpO1xyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX3NldEhhbmRsZVBvcyh0aGlzLiRoYW5kbGUsIHRoaXMuaW5wdXRzLmVxKDApLnZhbCgpLCB0cnVlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIF9yZWZsb3coKSB7XHJcbiAgICB0aGlzLnNldEhhbmRsZXMoKTtcclxuICB9XHJcbiAgLyoqXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSBmbG9hdGluZyBwb2ludCAodGhlIHZhbHVlKSB0byBiZSB0cmFuc2Zvcm1lZCB1c2luZyB0byBhIHJlbGF0aXZlIHBvc2l0aW9uIG9uIHRoZSBzbGlkZXIgKHRoZSBpbnZlcnNlIG9mIF92YWx1ZSlcclxuICAqL1xyXG4gIF9wY3RPZkJhcih2YWx1ZSkge1xyXG4gICAgdmFyIHBjdE9mQmFyID0gcGVyY2VudCh2YWx1ZSAtIHRoaXMub3B0aW9ucy5zdGFydCwgdGhpcy5vcHRpb25zLmVuZCAtIHRoaXMub3B0aW9ucy5zdGFydClcclxuXHJcbiAgICBzd2l0Y2godGhpcy5vcHRpb25zLnBvc2l0aW9uVmFsdWVGdW5jdGlvbikge1xyXG4gICAgY2FzZSBcInBvd1wiOlxyXG4gICAgICBwY3RPZkJhciA9IHRoaXMuX2xvZ1RyYW5zZm9ybShwY3RPZkJhcik7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImxvZ1wiOlxyXG4gICAgICBwY3RPZkJhciA9IHRoaXMuX3Bvd1RyYW5zZm9ybShwY3RPZkJhcik7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwY3RPZkJhci50b0ZpeGVkKDIpXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqIEBwYXJhbSB7TnVtYmVyfSBwY3RPZkJhciAtIGZsb2F0aW5nIHBvaW50LCB0aGUgcmVsYXRpdmUgcG9zaXRpb24gb2YgdGhlIHNsaWRlciAodHlwaWNhbGx5IGJldHdlZW4gMC0xKSB0byBiZSB0cmFuc2Zvcm1lZCB0byBhIHZhbHVlXHJcbiAgKi9cclxuICBfdmFsdWUocGN0T2ZCYXIpIHtcclxuICAgIHN3aXRjaCh0aGlzLm9wdGlvbnMucG9zaXRpb25WYWx1ZUZ1bmN0aW9uKSB7XHJcbiAgICBjYXNlIFwicG93XCI6XHJcbiAgICAgIHBjdE9mQmFyID0gdGhpcy5fcG93VHJhbnNmb3JtKHBjdE9mQmFyKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwibG9nXCI6XHJcbiAgICAgIHBjdE9mQmFyID0gdGhpcy5fbG9nVHJhbnNmb3JtKHBjdE9mQmFyKTtcclxuICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgICB2YXIgdmFsdWUgPSAodGhpcy5vcHRpb25zLmVuZCAtIHRoaXMub3B0aW9ucy5zdGFydCkgKiBwY3RPZkJhciArIHRoaXMub3B0aW9ucy5zdGFydDtcclxuXHJcbiAgICByZXR1cm4gdmFsdWVcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0gZmxvYXRpbmcgcG9pbnQgKHR5cGljYWxseSBiZXR3ZWVuIDAtMSkgdG8gYmUgdHJhbnNmb3JtZWQgdXNpbmcgdGhlIGxvZyBmdW5jdGlvblxyXG4gICovXHJcbiAgX2xvZ1RyYW5zZm9ybSh2YWx1ZSkge1xyXG4gICAgcmV0dXJuIGJhc2VMb2codGhpcy5vcHRpb25zLm5vbkxpbmVhckJhc2UsICgodmFsdWUqKHRoaXMub3B0aW9ucy5ub25MaW5lYXJCYXNlLTEpKSsxKSlcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0gZmxvYXRpbmcgcG9pbnQgKHR5cGljYWxseSBiZXR3ZWVuIDAtMSkgdG8gYmUgdHJhbnNmb3JtZWQgdXNpbmcgdGhlIHBvd2VyIGZ1bmN0aW9uXHJcbiAgKi9cclxuICBfcG93VHJhbnNmb3JtKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gKE1hdGgucG93KHRoaXMub3B0aW9ucy5ub25MaW5lYXJCYXNlLCB2YWx1ZSkgLSAxKSAvICh0aGlzLm9wdGlvbnMubm9uTGluZWFyQmFzZSAtIDEpXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBwb3NpdGlvbiBvZiB0aGUgc2VsZWN0ZWQgaGFuZGxlIGFuZCBmaWxsIGJhci5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkaG5kbCAtIHRoZSBzZWxlY3RlZCBoYW5kbGUgdG8gbW92ZS5cclxuICAgKiBAcGFyYW0ge051bWJlcn0gbG9jYXRpb24gLSBmbG9hdGluZyBwb2ludCBiZXR3ZWVuIHRoZSBzdGFydCBhbmQgZW5kIHZhbHVlcyBvZiB0aGUgc2xpZGVyIGJhci5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGZpcmUgb24gY29tcGxldGlvbi5cclxuICAgKiBAZmlyZXMgU2xpZGVyI21vdmVkXHJcbiAgICogQGZpcmVzIFNsaWRlciNjaGFuZ2VkXHJcbiAgICovXHJcbiAgX3NldEhhbmRsZVBvcygkaG5kbCwgbG9jYXRpb24sIG5vSW52ZXJ0LCBjYikge1xyXG4gICAgLy8gZG9uJ3QgbW92ZSBpZiB0aGUgc2xpZGVyIGhhcyBiZWVuIGRpc2FibGVkIHNpbmNlIGl0cyBpbml0aWFsaXphdGlvblxyXG4gICAgaWYgKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3ModGhpcy5vcHRpb25zLmRpc2FibGVkQ2xhc3MpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vbWlnaHQgbmVlZCB0byBhbHRlciB0aGF0IHNsaWdodGx5IGZvciBiYXJzIHRoYXQgd2lsbCBoYXZlIG9kZCBudW1iZXIgc2VsZWN0aW9ucy5cclxuICAgIGxvY2F0aW9uID0gcGFyc2VGbG9hdChsb2NhdGlvbik7Ly9vbiBpbnB1dCBjaGFuZ2UgZXZlbnRzLCBjb252ZXJ0IHN0cmluZyB0byBudW1iZXIuLi5ncnVtYmxlLlxyXG5cclxuICAgIC8vIHByZXZlbnQgc2xpZGVyIGZyb20gcnVubmluZyBvdXQgb2YgYm91bmRzLCBpZiB2YWx1ZSBleGNlZWRzIHRoZSBsaW1pdHMgc2V0IHRocm91Z2ggb3B0aW9ucywgb3ZlcnJpZGUgdGhlIHZhbHVlIHRvIG1pbi9tYXhcclxuICAgIGlmIChsb2NhdGlvbiA8IHRoaXMub3B0aW9ucy5zdGFydCkgeyBsb2NhdGlvbiA9IHRoaXMub3B0aW9ucy5zdGFydDsgfVxyXG4gICAgZWxzZSBpZiAobG9jYXRpb24gPiB0aGlzLm9wdGlvbnMuZW5kKSB7IGxvY2F0aW9uID0gdGhpcy5vcHRpb25zLmVuZDsgfVxyXG5cclxuICAgIHZhciBpc0RibCA9IHRoaXMub3B0aW9ucy5kb3VibGVTaWRlZDtcclxuXHJcbiAgICBpZiAoaXNEYmwpIHsgLy90aGlzIGJsb2NrIGlzIHRvIHByZXZlbnQgMiBoYW5kbGVzIGZyb20gY3Jvc3NpbmcgZWFjaG90aGVyLiBDb3VsZC9zaG91bGQgYmUgaW1wcm92ZWQuXHJcbiAgICAgIGlmICh0aGlzLmhhbmRsZXMuaW5kZXgoJGhuZGwpID09PSAwKSB7XHJcbiAgICAgICAgdmFyIGgyVmFsID0gcGFyc2VGbG9hdCh0aGlzLiRoYW5kbGUyLmF0dHIoJ2FyaWEtdmFsdWVub3cnKSk7XHJcbiAgICAgICAgbG9jYXRpb24gPSBsb2NhdGlvbiA+PSBoMlZhbCA/IGgyVmFsIC0gdGhpcy5vcHRpb25zLnN0ZXAgOiBsb2NhdGlvbjtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB2YXIgaDFWYWwgPSBwYXJzZUZsb2F0KHRoaXMuJGhhbmRsZS5hdHRyKCdhcmlhLXZhbHVlbm93JykpO1xyXG4gICAgICAgIGxvY2F0aW9uID0gbG9jYXRpb24gPD0gaDFWYWwgPyBoMVZhbCArIHRoaXMub3B0aW9ucy5zdGVwIDogbG9jYXRpb247XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvL3RoaXMgaXMgZm9yIHNpbmdsZS1oYW5kbGVkIHZlcnRpY2FsIHNsaWRlcnMsIGl0IGFkanVzdHMgdGhlIHZhbHVlIHRvIGFjY291bnQgZm9yIHRoZSBzbGlkZXIgYmVpbmcgXCJ1cHNpZGUtZG93blwiXHJcbiAgICAvL2ZvciBjbGljayBhbmQgZHJhZyBldmVudHMsIGl0J3Mgd2VpcmQgZHVlIHRvIHRoZSBzY2FsZSgtMSwgMSkgY3NzIHByb3BlcnR5XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnZlcnRpY2FsICYmICFub0ludmVydCkge1xyXG4gICAgICBsb2NhdGlvbiA9IHRoaXMub3B0aW9ucy5lbmQgLSBsb2NhdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIHZlcnQgPSB0aGlzLm9wdGlvbnMudmVydGljYWwsXHJcbiAgICAgICAgaE9yVyA9IHZlcnQgPyAnaGVpZ2h0JyA6ICd3aWR0aCcsXHJcbiAgICAgICAgbE9yVCA9IHZlcnQgPyAndG9wJyA6ICdsZWZ0JyxcclxuICAgICAgICBoYW5kbGVEaW0gPSAkaG5kbFswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVtoT3JXXSxcclxuICAgICAgICBlbGVtRGltID0gdGhpcy4kZWxlbWVudFswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVtoT3JXXSxcclxuICAgICAgICAvL3BlcmNlbnRhZ2Ugb2YgYmFyIG1pbi9tYXggdmFsdWUgYmFzZWQgb24gY2xpY2sgb3IgZHJhZyBwb2ludFxyXG4gICAgICAgIHBjdE9mQmFyID0gdGhpcy5fcGN0T2ZCYXIobG9jYXRpb24pLFxyXG4gICAgICAgIC8vbnVtYmVyIG9mIGFjdHVhbCBwaXhlbHMgdG8gc2hpZnQgdGhlIGhhbmRsZSwgYmFzZWQgb24gdGhlIHBlcmNlbnRhZ2Ugb2J0YWluZWQgYWJvdmVcclxuICAgICAgICBweFRvTW92ZSA9IChlbGVtRGltIC0gaGFuZGxlRGltKSAqIHBjdE9mQmFyLFxyXG4gICAgICAgIC8vcGVyY2VudGFnZSBvZiBiYXIgdG8gc2hpZnQgdGhlIGhhbmRsZVxyXG4gICAgICAgIG1vdmVtZW50ID0gKHBlcmNlbnQocHhUb01vdmUsIGVsZW1EaW0pICogMTAwKS50b0ZpeGVkKHRoaXMub3B0aW9ucy5kZWNpbWFsKTtcclxuICAgICAgICAvL2ZpeGluZyB0aGUgZGVjaW1hbCB2YWx1ZSBmb3IgdGhlIGxvY2F0aW9uIG51bWJlciwgaXMgcGFzc2VkIHRvIG90aGVyIG1ldGhvZHMgYXMgYSBmaXhlZCBmbG9hdGluZy1wb2ludCB2YWx1ZVxyXG4gICAgICAgIGxvY2F0aW9uID0gcGFyc2VGbG9hdChsb2NhdGlvbi50b0ZpeGVkKHRoaXMub3B0aW9ucy5kZWNpbWFsKSk7XHJcbiAgICAgICAgLy8gZGVjbGFyZSBlbXB0eSBvYmplY3QgZm9yIGNzcyBhZGp1c3RtZW50cywgb25seSB1c2VkIHdpdGggMiBoYW5kbGVkLXNsaWRlcnNcclxuICAgIHZhciBjc3MgPSB7fTtcclxuXHJcbiAgICB0aGlzLl9zZXRWYWx1ZXMoJGhuZGwsIGxvY2F0aW9uKTtcclxuXHJcbiAgICAvLyBUT0RPIHVwZGF0ZSB0byBjYWxjdWxhdGUgYmFzZWQgb24gdmFsdWVzIHNldCB0byByZXNwZWN0aXZlIGlucHV0cz8/XHJcbiAgICBpZiAoaXNEYmwpIHtcclxuICAgICAgdmFyIGlzTGVmdEhuZGwgPSB0aGlzLmhhbmRsZXMuaW5kZXgoJGhuZGwpID09PSAwLFxyXG4gICAgICAgICAgLy9lbXB0eSB2YXJpYWJsZSwgd2lsbCBiZSB1c2VkIGZvciBtaW4taGVpZ2h0L3dpZHRoIGZvciBmaWxsIGJhclxyXG4gICAgICAgICAgZGltLFxyXG4gICAgICAgICAgLy9wZXJjZW50YWdlIHcvaCBvZiB0aGUgaGFuZGxlIGNvbXBhcmVkIHRvIHRoZSBzbGlkZXIgYmFyXHJcbiAgICAgICAgICBoYW5kbGVQY3QgPSAgfn4ocGVyY2VudChoYW5kbGVEaW0sIGVsZW1EaW0pICogMTAwKTtcclxuICAgICAgLy9pZiBsZWZ0IGhhbmRsZSwgdGhlIG1hdGggaXMgc2xpZ2h0bHkgZGlmZmVyZW50IHRoYW4gaWYgaXQncyB0aGUgcmlnaHQgaGFuZGxlLCBhbmQgdGhlIGxlZnQvdG9wIHByb3BlcnR5IG5lZWRzIHRvIGJlIGNoYW5nZWQgZm9yIHRoZSBmaWxsIGJhclxyXG4gICAgICBpZiAoaXNMZWZ0SG5kbCkge1xyXG4gICAgICAgIC8vbGVmdCBvciB0b3AgcGVyY2VudGFnZSB2YWx1ZSB0byBhcHBseSB0byB0aGUgZmlsbCBiYXIuXHJcbiAgICAgICAgY3NzW2xPclRdID0gYCR7bW92ZW1lbnR9JWA7XHJcbiAgICAgICAgLy9jYWxjdWxhdGUgdGhlIG5ldyBtaW4taGVpZ2h0L3dpZHRoIGZvciB0aGUgZmlsbCBiYXIuXHJcbiAgICAgICAgZGltID0gcGFyc2VGbG9hdCh0aGlzLiRoYW5kbGUyWzBdLnN0eWxlW2xPclRdKSAtIG1vdmVtZW50ICsgaGFuZGxlUGN0O1xyXG4gICAgICAgIC8vdGhpcyBjYWxsYmFjayBpcyBuZWNlc3NhcnkgdG8gcHJldmVudCBlcnJvcnMgYW5kIGFsbG93IHRoZSBwcm9wZXIgcGxhY2VtZW50IGFuZCBpbml0aWFsaXphdGlvbiBvZiBhIDItaGFuZGxlZCBzbGlkZXJcclxuICAgICAgICAvL3BsdXMsIGl0IG1lYW5zIHdlIGRvbid0IGNhcmUgaWYgJ2RpbScgaXNOYU4gb24gaW5pdCwgaXQgd29uJ3QgYmUgaW4gdGhlIGZ1dHVyZS5cclxuICAgICAgICBpZiAoY2IgJiYgdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7IGNiKCk7IH0vL3RoaXMgaXMgb25seSBuZWVkZWQgZm9yIHRoZSBpbml0aWFsaXphdGlvbiBvZiAyIGhhbmRsZWQgc2xpZGVyc1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vanVzdCBjYWNoaW5nIHRoZSB2YWx1ZSBvZiB0aGUgbGVmdC9ib3R0b20gaGFuZGxlJ3MgbGVmdC90b3AgcHJvcGVydHlcclxuICAgICAgICB2YXIgaGFuZGxlUG9zID0gcGFyc2VGbG9hdCh0aGlzLiRoYW5kbGVbMF0uc3R5bGVbbE9yVF0pO1xyXG4gICAgICAgIC8vY2FsY3VsYXRlIHRoZSBuZXcgbWluLWhlaWdodC93aWR0aCBmb3IgdGhlIGZpbGwgYmFyLiBVc2UgaXNOYU4gdG8gcHJldmVudCBmYWxzZSBwb3NpdGl2ZXMgZm9yIG51bWJlcnMgPD0gMFxyXG4gICAgICAgIC8vYmFzZWQgb24gdGhlIHBlcmNlbnRhZ2Ugb2YgbW92ZW1lbnQgb2YgdGhlIGhhbmRsZSBiZWluZyBtYW5pcHVsYXRlZCwgbGVzcyB0aGUgb3Bwb3NpbmcgaGFuZGxlJ3MgbGVmdC90b3AgcG9zaXRpb24sIHBsdXMgdGhlIHBlcmNlbnRhZ2Ugdy9oIG9mIHRoZSBoYW5kbGUgaXRzZWxmXHJcbiAgICAgICAgZGltID0gbW92ZW1lbnQgLSAoaXNOYU4oaGFuZGxlUG9zKSA/ICh0aGlzLm9wdGlvbnMuaW5pdGlhbFN0YXJ0IC0gdGhpcy5vcHRpb25zLnN0YXJ0KS8oKHRoaXMub3B0aW9ucy5lbmQtdGhpcy5vcHRpb25zLnN0YXJ0KS8xMDApIDogaGFuZGxlUG9zKSArIGhhbmRsZVBjdDtcclxuICAgICAgfVxyXG4gICAgICAvLyBhc3NpZ24gdGhlIG1pbi1oZWlnaHQvd2lkdGggdG8gb3VyIGNzcyBvYmplY3RcclxuICAgICAgY3NzW2BtaW4tJHtoT3JXfWBdID0gYCR7ZGltfSVgO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub25lKCdmaW5pc2hlZC56Zi5hbmltYXRlJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgaGFuZGxlIGlzIGRvbmUgbW92aW5nLlxyXG4gICAgICAgICAgICAgICAgICAgICAqIEBldmVudCBTbGlkZXIjbW92ZWRcclxuICAgICAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgICAgICBfdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdtb3ZlZC56Zi5zbGlkZXInLCBbJGhuZGxdKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgIC8vYmVjYXVzZSB3ZSBkb24ndCBrbm93IGV4YWN0bHkgaG93IHRoZSBoYW5kbGUgd2lsbCBiZSBtb3ZlZCwgY2hlY2sgdGhlIGFtb3VudCBvZiB0aW1lIGl0IHNob3VsZCB0YWtlIHRvIG1vdmUuXHJcbiAgICB2YXIgbW92ZVRpbWUgPSB0aGlzLiRlbGVtZW50LmRhdGEoJ2RyYWdnaW5nJykgPyAxMDAwLzYwIDogdGhpcy5vcHRpb25zLm1vdmVUaW1lO1xyXG5cclxuICAgIEZvdW5kYXRpb24uTW92ZShtb3ZlVGltZSwgJGhuZGwsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAvLyBhZGp1c3RpbmcgdGhlIGxlZnQvdG9wIHByb3BlcnR5IG9mIHRoZSBoYW5kbGUsIGJhc2VkIG9uIHRoZSBwZXJjZW50YWdlIGNhbGN1bGF0ZWQgYWJvdmVcclxuICAgICAgLy8gaWYgbW92ZW1lbnQgaXNOYU4sIHRoYXQgaXMgYmVjYXVzZSB0aGUgc2xpZGVyIGlzIGhpZGRlbiBhbmQgd2UgY2Fubm90IGRldGVybWluZSBoYW5kbGUgd2lkdGgsXHJcbiAgICAgIC8vIGZhbGwgYmFjayB0byBuZXh0IGJlc3QgZ3Vlc3MuXHJcbiAgICAgIGlmIChpc05hTihtb3ZlbWVudCkpIHtcclxuICAgICAgICAkaG5kbC5jc3MobE9yVCwgYCR7cGN0T2ZCYXIgKiAxMDB9JWApO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgICRobmRsLmNzcyhsT3JULCBgJHttb3ZlbWVudH0lYCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICghX3RoaXMub3B0aW9ucy5kb3VibGVTaWRlZCkge1xyXG4gICAgICAgIC8vaWYgc2luZ2xlLWhhbmRsZWQsIGEgc2ltcGxlIG1ldGhvZCB0byBleHBhbmQgdGhlIGZpbGwgYmFyXHJcbiAgICAgICAgX3RoaXMuJGZpbGwuY3NzKGhPclcsIGAke3BjdE9mQmFyICogMTAwfSVgKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvL290aGVyd2lzZSwgdXNlIHRoZSBjc3Mgb2JqZWN0IHdlIGNyZWF0ZWQgYWJvdmVcclxuICAgICAgICBfdGhpcy4kZmlsbC5jc3MoY3NzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgdmFsdWUgaGFzIG5vdCBiZWVuIGNoYW5nZSBmb3IgYSBnaXZlbiB0aW1lLlxyXG4gICAgICogQGV2ZW50IFNsaWRlciNjaGFuZ2VkXHJcbiAgICAgKi9cclxuICAgIGNsZWFyVGltZW91dChfdGhpcy50aW1lb3V0KTtcclxuICAgIF90aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgIF90aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2NoYW5nZWQuemYuc2xpZGVyJywgWyRobmRsXSk7XHJcbiAgICB9LCBfdGhpcy5vcHRpb25zLmNoYW5nZWREZWxheSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBpbml0aWFsIGF0dHJpYnV0ZSBmb3IgdGhlIHNsaWRlciBlbGVtZW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGlkeCAtIGluZGV4IG9mIHRoZSBjdXJyZW50IGhhbmRsZS9pbnB1dCB0byB1c2UuXHJcbiAgICovXHJcbiAgX3NldEluaXRBdHRyKGlkeCkge1xyXG4gICAgdmFyIGluaXRWYWwgPSAoaWR4ID09PSAwID8gdGhpcy5vcHRpb25zLmluaXRpYWxTdGFydCA6IHRoaXMub3B0aW9ucy5pbml0aWFsRW5kKVxyXG4gICAgdmFyIGlkID0gdGhpcy5pbnB1dHMuZXEoaWR4KS5hdHRyKCdpZCcpIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ3NsaWRlcicpO1xyXG4gICAgdGhpcy5pbnB1dHMuZXEoaWR4KS5hdHRyKHtcclxuICAgICAgJ2lkJzogaWQsXHJcbiAgICAgICdtYXgnOiB0aGlzLm9wdGlvbnMuZW5kLFxyXG4gICAgICAnbWluJzogdGhpcy5vcHRpb25zLnN0YXJ0LFxyXG4gICAgICAnc3RlcCc6IHRoaXMub3B0aW9ucy5zdGVwXHJcbiAgICB9KTtcclxuICAgIHRoaXMuaW5wdXRzLmVxKGlkeCkudmFsKGluaXRWYWwpO1xyXG4gICAgdGhpcy5oYW5kbGVzLmVxKGlkeCkuYXR0cih7XHJcbiAgICAgICdyb2xlJzogJ3NsaWRlcicsXHJcbiAgICAgICdhcmlhLWNvbnRyb2xzJzogaWQsXHJcbiAgICAgICdhcmlhLXZhbHVlbWF4JzogdGhpcy5vcHRpb25zLmVuZCxcclxuICAgICAgJ2FyaWEtdmFsdWVtaW4nOiB0aGlzLm9wdGlvbnMuc3RhcnQsXHJcbiAgICAgICdhcmlhLXZhbHVlbm93JzogaW5pdFZhbCxcclxuICAgICAgJ2FyaWEtb3JpZW50YXRpb24nOiB0aGlzLm9wdGlvbnMudmVydGljYWwgPyAndmVydGljYWwnIDogJ2hvcml6b250YWwnLFxyXG4gICAgICAndGFiaW5kZXgnOiAwXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGlucHV0IGFuZCBgYXJpYS12YWx1ZW5vd2AgdmFsdWVzIGZvciB0aGUgc2xpZGVyIGVsZW1lbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGhhbmRsZSAtIHRoZSBjdXJyZW50bHkgc2VsZWN0ZWQgaGFuZGxlLlxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWwgLSBmbG9hdGluZyBwb2ludCBvZiB0aGUgbmV3IHZhbHVlLlxyXG4gICAqL1xyXG4gIF9zZXRWYWx1ZXMoJGhhbmRsZSwgdmFsKSB7XHJcbiAgICB2YXIgaWR4ID0gdGhpcy5vcHRpb25zLmRvdWJsZVNpZGVkID8gdGhpcy5oYW5kbGVzLmluZGV4KCRoYW5kbGUpIDogMDtcclxuICAgIHRoaXMuaW5wdXRzLmVxKGlkeCkudmFsKHZhbCk7XHJcbiAgICAkaGFuZGxlLmF0dHIoJ2FyaWEtdmFsdWVub3cnLCB2YWwpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlcyBldmVudHMgb24gdGhlIHNsaWRlciBlbGVtZW50LlxyXG4gICAqIENhbGN1bGF0ZXMgdGhlIG5ldyBsb2NhdGlvbiBvZiB0aGUgY3VycmVudCBoYW5kbGUuXHJcbiAgICogSWYgdGhlcmUgYXJlIHR3byBoYW5kbGVzIGFuZCB0aGUgYmFyIHdhcyBjbGlja2VkLCBpdCBkZXRlcm1pbmVzIHdoaWNoIGhhbmRsZSB0byBtb3ZlLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGUgLSB0aGUgYGV2ZW50YCBvYmplY3QgcGFzc2VkIGZyb20gdGhlIGxpc3RlbmVyLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkaGFuZGxlIC0gdGhlIGN1cnJlbnQgaGFuZGxlIHRvIGNhbGN1bGF0ZSBmb3IsIGlmIHNlbGVjdGVkLlxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWwgLSBmbG9hdGluZyBwb2ludCBudW1iZXIgZm9yIHRoZSBuZXcgdmFsdWUgb2YgdGhlIHNsaWRlci5cclxuICAgKiBUT0RPIGNsZWFuIHRoaXMgdXAsIHRoZXJlJ3MgYSBsb3Qgb2YgcmVwZWF0ZWQgY29kZSBiZXR3ZWVuIHRoaXMgYW5kIHRoZSBfc2V0SGFuZGxlUG9zIGZuLlxyXG4gICAqL1xyXG4gIF9oYW5kbGVFdmVudChlLCAkaGFuZGxlLCB2YWwpIHtcclxuICAgIHZhciB2YWx1ZSwgaGFzVmFsO1xyXG4gICAgaWYgKCF2YWwpIHsvL2NsaWNrIG9yIGRyYWcgZXZlbnRzXHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICAgIHZlcnRpY2FsID0gdGhpcy5vcHRpb25zLnZlcnRpY2FsLFxyXG4gICAgICAgICAgcGFyYW0gPSB2ZXJ0aWNhbCA/ICdoZWlnaHQnIDogJ3dpZHRoJyxcclxuICAgICAgICAgIGRpcmVjdGlvbiA9IHZlcnRpY2FsID8gJ3RvcCcgOiAnbGVmdCcsXHJcbiAgICAgICAgICBldmVudE9mZnNldCA9IHZlcnRpY2FsID8gZS5wYWdlWSA6IGUucGFnZVgsXHJcbiAgICAgICAgICBoYWxmT2ZIYW5kbGUgPSB0aGlzLiRoYW5kbGVbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClbcGFyYW1dIC8gMixcclxuICAgICAgICAgIGJhckRpbSA9IHRoaXMuJGVsZW1lbnRbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClbcGFyYW1dLFxyXG4gICAgICAgICAgd2luZG93U2Nyb2xsID0gdmVydGljYWwgPyAkKHdpbmRvdykuc2Nyb2xsVG9wKCkgOiAkKHdpbmRvdykuc2Nyb2xsTGVmdCgpO1xyXG5cclxuXHJcbiAgICAgIHZhciBlbGVtT2Zmc2V0ID0gdGhpcy4kZWxlbWVudC5vZmZzZXQoKVtkaXJlY3Rpb25dO1xyXG5cclxuICAgICAgLy8gdG91Y2ggZXZlbnRzIGVtdWxhdGVkIGJ5IHRoZSB0b3VjaCB1dGlsIGdpdmUgcG9zaXRpb24gcmVsYXRpdmUgdG8gc2NyZWVuLCBhZGQgd2luZG93LnNjcm9sbCB0byBldmVudCBjb29yZGluYXRlcy4uLlxyXG4gICAgICAvLyBiZXN0IHdheSB0byBndWVzcyB0aGlzIGlzIHNpbXVsYXRlZCBpcyBpZiBjbGllbnRZID09IHBhZ2VZXHJcbiAgICAgIGlmIChlLmNsaWVudFkgPT09IGUucGFnZVkpIHsgZXZlbnRPZmZzZXQgPSBldmVudE9mZnNldCArIHdpbmRvd1Njcm9sbDsgfVxyXG4gICAgICB2YXIgZXZlbnRGcm9tQmFyID0gZXZlbnRPZmZzZXQgLSBlbGVtT2Zmc2V0O1xyXG4gICAgICB2YXIgYmFyWFk7XHJcbiAgICAgIGlmIChldmVudEZyb21CYXIgPCAwKSB7XHJcbiAgICAgICAgYmFyWFkgPSAwO1xyXG4gICAgICB9IGVsc2UgaWYgKGV2ZW50RnJvbUJhciA+IGJhckRpbSkge1xyXG4gICAgICAgIGJhclhZID0gYmFyRGltO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGJhclhZID0gZXZlbnRGcm9tQmFyO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBvZmZzZXRQY3QgPSBwZXJjZW50KGJhclhZLCBiYXJEaW0pO1xyXG5cclxuICAgICAgdmFsdWUgPSB0aGlzLl92YWx1ZShvZmZzZXRQY3QpO1xyXG5cclxuICAgICAgLy8gdHVybiBldmVyeXRoaW5nIGFyb3VuZCBmb3IgUlRMLCB5YXkgbWF0aCFcclxuICAgICAgaWYgKEZvdW5kYXRpb24ucnRsKCkgJiYgIXRoaXMub3B0aW9ucy52ZXJ0aWNhbCkge3ZhbHVlID0gdGhpcy5vcHRpb25zLmVuZCAtIHZhbHVlO31cclxuXHJcbiAgICAgIHZhbHVlID0gX3RoaXMuX2FkanVzdFZhbHVlKG51bGwsIHZhbHVlKTtcclxuICAgICAgLy9ib29sZWFuIGZsYWcgZm9yIHRoZSBzZXRIYW5kbGVQb3MgZm4sIHNwZWNpZmljYWxseSBmb3IgdmVydGljYWwgc2xpZGVyc1xyXG4gICAgICBoYXNWYWwgPSBmYWxzZTtcclxuXHJcbiAgICAgIGlmICghJGhhbmRsZSkgey8vZmlndXJlIG91dCB3aGljaCBoYW5kbGUgaXQgaXMsIHBhc3MgaXQgdG8gdGhlIG5leHQgZnVuY3Rpb24uXHJcbiAgICAgICAgdmFyIGZpcnN0SG5kbFBvcyA9IGFic1Bvc2l0aW9uKHRoaXMuJGhhbmRsZSwgZGlyZWN0aW9uLCBiYXJYWSwgcGFyYW0pLFxyXG4gICAgICAgICAgICBzZWNuZEhuZGxQb3MgPSBhYnNQb3NpdGlvbih0aGlzLiRoYW5kbGUyLCBkaXJlY3Rpb24sIGJhclhZLCBwYXJhbSk7XHJcbiAgICAgICAgICAgICRoYW5kbGUgPSBmaXJzdEhuZGxQb3MgPD0gc2VjbmRIbmRsUG9zID8gdGhpcy4kaGFuZGxlIDogdGhpcy4kaGFuZGxlMjtcclxuICAgICAgfVxyXG5cclxuICAgIH0gZWxzZSB7Ly9jaGFuZ2UgZXZlbnQgb24gaW5wdXRcclxuICAgICAgdmFsdWUgPSB0aGlzLl9hZGp1c3RWYWx1ZShudWxsLCB2YWwpO1xyXG4gICAgICBoYXNWYWwgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3NldEhhbmRsZVBvcygkaGFuZGxlLCB2YWx1ZSwgaGFzVmFsKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkanVzdGVzIHZhbHVlIGZvciBoYW5kbGUgaW4gcmVnYXJkIHRvIHN0ZXAgdmFsdWUuIHJldHVybnMgYWRqdXN0ZWQgdmFsdWVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkaGFuZGxlIC0gdGhlIHNlbGVjdGVkIGhhbmRsZS5cclxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSB2YWx1ZSB0byBhZGp1c3QuIHVzZWQgaWYgJGhhbmRsZSBpcyBmYWxzeVxyXG4gICAqL1xyXG4gIF9hZGp1c3RWYWx1ZSgkaGFuZGxlLCB2YWx1ZSkge1xyXG4gICAgdmFyIHZhbCxcclxuICAgICAgc3RlcCA9IHRoaXMub3B0aW9ucy5zdGVwLFxyXG4gICAgICBkaXYgPSBwYXJzZUZsb2F0KHN0ZXAvMiksXHJcbiAgICAgIGxlZnQsIHByZXZfdmFsLCBuZXh0X3ZhbDtcclxuICAgIGlmICghISRoYW5kbGUpIHtcclxuICAgICAgdmFsID0gcGFyc2VGbG9hdCgkaGFuZGxlLmF0dHIoJ2FyaWEtdmFsdWVub3cnKSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgdmFsID0gdmFsdWU7XHJcbiAgICB9XHJcbiAgICBsZWZ0ID0gdmFsICUgc3RlcDtcclxuICAgIHByZXZfdmFsID0gdmFsIC0gbGVmdDtcclxuICAgIG5leHRfdmFsID0gcHJldl92YWwgKyBzdGVwO1xyXG4gICAgaWYgKGxlZnQgPT09IDApIHtcclxuICAgICAgcmV0dXJuIHZhbDtcclxuICAgIH1cclxuICAgIHZhbCA9IHZhbCA+PSBwcmV2X3ZhbCArIGRpdiA/IG5leHRfdmFsIDogcHJldl92YWw7XHJcbiAgICByZXR1cm4gdmFsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBsaXN0ZW5lcnMgdG8gdGhlIHNsaWRlciBlbGVtZW50cy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB0aGlzLl9ldmVudHNGb3JIYW5kbGUodGhpcy4kaGFuZGxlKTtcclxuICAgIGlmKHRoaXMuaGFuZGxlc1sxXSkge1xyXG4gICAgICB0aGlzLl9ldmVudHNGb3JIYW5kbGUodGhpcy4kaGFuZGxlMik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBsaXN0ZW5lcnMgYSBwYXJ0aWN1bGFyIGhhbmRsZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRoYW5kbGUgLSB0aGUgY3VycmVudCBoYW5kbGUgdG8gYXBwbHkgbGlzdGVuZXJzIHRvLlxyXG4gICAqL1xyXG4gIF9ldmVudHNGb3JIYW5kbGUoJGhhbmRsZSkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICBjdXJIYW5kbGUsXHJcbiAgICAgICAgdGltZXI7XHJcblxyXG4gICAgICB0aGlzLmlucHV0cy5vZmYoJ2NoYW5nZS56Zi5zbGlkZXInKS5vbignY2hhbmdlLnpmLnNsaWRlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICB2YXIgaWR4ID0gX3RoaXMuaW5wdXRzLmluZGV4KCQodGhpcykpO1xyXG4gICAgICAgIF90aGlzLl9oYW5kbGVFdmVudChlLCBfdGhpcy5oYW5kbGVzLmVxKGlkeCksICQodGhpcykudmFsKCkpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuY2xpY2tTZWxlY3QpIHtcclxuICAgICAgICB0aGlzLiRlbGVtZW50Lm9mZignY2xpY2suemYuc2xpZGVyJykub24oJ2NsaWNrLnpmLnNsaWRlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgIGlmIChfdGhpcy4kZWxlbWVudC5kYXRhKCdkcmFnZ2luZycpKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuICAgICAgICAgIGlmICghJChlLnRhcmdldCkuaXMoJ1tkYXRhLXNsaWRlci1oYW5kbGVdJykpIHtcclxuICAgICAgICAgICAgaWYgKF90aGlzLm9wdGlvbnMuZG91YmxlU2lkZWQpIHtcclxuICAgICAgICAgICAgICBfdGhpcy5faGFuZGxlRXZlbnQoZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgX3RoaXMuX2hhbmRsZUV2ZW50KGUsIF90aGlzLiRoYW5kbGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmRyYWdnYWJsZSkge1xyXG4gICAgICB0aGlzLmhhbmRsZXMuYWRkVG91Y2goKTtcclxuXHJcbiAgICAgIHZhciAkYm9keSA9ICQoJ2JvZHknKTtcclxuICAgICAgJGhhbmRsZVxyXG4gICAgICAgIC5vZmYoJ21vdXNlZG93bi56Zi5zbGlkZXInKVxyXG4gICAgICAgIC5vbignbW91c2Vkb3duLnpmLnNsaWRlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICRoYW5kbGUuYWRkQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7XHJcbiAgICAgICAgICBfdGhpcy4kZmlsbC5hZGRDbGFzcygnaXMtZHJhZ2dpbmcnKTsvL1xyXG4gICAgICAgICAgX3RoaXMuJGVsZW1lbnQuZGF0YSgnZHJhZ2dpbmcnLCB0cnVlKTtcclxuXHJcbiAgICAgICAgICBjdXJIYW5kbGUgPSAkKGUuY3VycmVudFRhcmdldCk7XHJcblxyXG4gICAgICAgICAgJGJvZHkub24oJ21vdXNlbW92ZS56Zi5zbGlkZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgX3RoaXMuX2hhbmRsZUV2ZW50KGUsIGN1ckhhbmRsZSk7XHJcblxyXG4gICAgICAgICAgfSkub24oJ21vdXNldXAuemYuc2xpZGVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBfdGhpcy5faGFuZGxlRXZlbnQoZSwgY3VySGFuZGxlKTtcclxuXHJcbiAgICAgICAgICAgICRoYW5kbGUucmVtb3ZlQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7XHJcbiAgICAgICAgICAgIF90aGlzLiRmaWxsLnJlbW92ZUNsYXNzKCdpcy1kcmFnZ2luZycpO1xyXG4gICAgICAgICAgICBfdGhpcy4kZWxlbWVudC5kYXRhKCdkcmFnZ2luZycsIGZhbHNlKTtcclxuXHJcbiAgICAgICAgICAgICRib2R5Lm9mZignbW91c2Vtb3ZlLnpmLnNsaWRlciBtb3VzZXVwLnpmLnNsaWRlcicpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC8vIHByZXZlbnQgZXZlbnRzIHRyaWdnZXJlZCBieSB0b3VjaFxyXG4gICAgICAub24oJ3NlbGVjdHN0YXJ0LnpmLnNsaWRlciB0b3VjaG1vdmUuemYuc2xpZGVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgJGhhbmRsZS5vZmYoJ2tleWRvd24uemYuc2xpZGVyJykub24oJ2tleWRvd24uemYuc2xpZGVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICB2YXIgXyRoYW5kbGUgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgaWR4ID0gX3RoaXMub3B0aW9ucy5kb3VibGVTaWRlZCA/IF90aGlzLmhhbmRsZXMuaW5kZXgoXyRoYW5kbGUpIDogMCxcclxuICAgICAgICAgIG9sZFZhbHVlID0gcGFyc2VGbG9hdChfdGhpcy5pbnB1dHMuZXEoaWR4KS52YWwoKSksXHJcbiAgICAgICAgICBuZXdWYWx1ZTtcclxuXHJcbiAgICAgIC8vIGhhbmRsZSBrZXlib2FyZCBldmVudCB3aXRoIGtleWJvYXJkIHV0aWxcclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ1NsaWRlcicsIHtcclxuICAgICAgICBkZWNyZWFzZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBuZXdWYWx1ZSA9IG9sZFZhbHVlIC0gX3RoaXMub3B0aW9ucy5zdGVwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaW5jcmVhc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgbmV3VmFsdWUgPSBvbGRWYWx1ZSArIF90aGlzLm9wdGlvbnMuc3RlcDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRlY3JlYXNlX2Zhc3Q6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgbmV3VmFsdWUgPSBvbGRWYWx1ZSAtIF90aGlzLm9wdGlvbnMuc3RlcCAqIDEwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaW5jcmVhc2VfZmFzdDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBuZXdWYWx1ZSA9IG9sZFZhbHVlICsgX3RoaXMub3B0aW9ucy5zdGVwICogMTA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbigpIHsgLy8gb25seSBzZXQgaGFuZGxlIHBvcyB3aGVuIGV2ZW50IHdhcyBoYW5kbGVkIHNwZWNpYWxseVxyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgX3RoaXMuX3NldEhhbmRsZVBvcyhfJGhhbmRsZSwgbmV3VmFsdWUsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIC8qaWYgKG5ld1ZhbHVlKSB7IC8vIGlmIHByZXNzZWQga2V5IGhhcyBzcGVjaWFsIGZ1bmN0aW9uLCB1cGRhdGUgdmFsdWVcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgX3RoaXMuX3NldEhhbmRsZVBvcyhfJGhhbmRsZSwgbmV3VmFsdWUpO1xyXG4gICAgICB9Ki9cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIHNsaWRlciBwbHVnaW4uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuaGFuZGxlcy5vZmYoJy56Zi5zbGlkZXInKTtcclxuICAgIHRoaXMuaW5wdXRzLm9mZignLnpmLnNsaWRlcicpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi5zbGlkZXInKTtcclxuXHJcbiAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5TbGlkZXIuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogTWluaW11bSB2YWx1ZSBmb3IgdGhlIHNsaWRlciBzY2FsZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMFxyXG4gICAqL1xyXG4gIHN0YXJ0OiAwLFxyXG4gIC8qKlxyXG4gICAqIE1heGltdW0gdmFsdWUgZm9yIHRoZSBzbGlkZXIgc2NhbGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEwMFxyXG4gICAqL1xyXG4gIGVuZDogMTAwLFxyXG4gIC8qKlxyXG4gICAqIE1pbmltdW0gdmFsdWUgY2hhbmdlIHBlciBjaGFuZ2UgZXZlbnQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDFcclxuICAgKi9cclxuICBzdGVwOiAxLFxyXG4gIC8qKlxyXG4gICAqIFZhbHVlIGF0IHdoaWNoIHRoZSBoYW5kbGUvaW5wdXQgKihsZWZ0IGhhbmRsZS9maXJzdCBpbnB1dCkqIHNob3VsZCBiZSBzZXQgdG8gb24gaW5pdGlhbGl6YXRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDBcclxuICAgKi9cclxuICBpbml0aWFsU3RhcnQ6IDAsXHJcbiAgLyoqXHJcbiAgICogVmFsdWUgYXQgd2hpY2ggdGhlIHJpZ2h0IGhhbmRsZS9zZWNvbmQgaW5wdXQgc2hvdWxkIGJlIHNldCB0byBvbiBpbml0aWFsaXphdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTAwXHJcbiAgICovXHJcbiAgaW5pdGlhbEVuZDogMTAwLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgaW5wdXQgdG8gYmUgbG9jYXRlZCBvdXRzaWRlIHRoZSBjb250YWluZXIgYW5kIHZpc2libGUuIFNldCB0byBieSB0aGUgSlNcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBiaW5kaW5nOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHVzZXIgdG8gY2xpY2svdGFwIG9uIHRoZSBzbGlkZXIgYmFyIHRvIHNlbGVjdCBhIHZhbHVlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xpY2tTZWxlY3Q6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogU2V0IHRvIHRydWUgYW5kIHVzZSB0aGUgYHZlcnRpY2FsYCBjbGFzcyB0byBjaGFuZ2UgYWxpZ25tZW50IHRvIHZlcnRpY2FsLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIHZlcnRpY2FsOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHVzZXIgdG8gZHJhZyB0aGUgc2xpZGVyIGhhbmRsZShzKSB0byBzZWxlY3QgYSB2YWx1ZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGRyYWdnYWJsZTogdHJ1ZSxcclxuICAvKipcclxuICAgKiBEaXNhYmxlcyB0aGUgc2xpZGVyIGFuZCBwcmV2ZW50cyBldmVudCBsaXN0ZW5lcnMgZnJvbSBiZWluZyBhcHBsaWVkLiBEb3VibGUgY2hlY2tlZCBieSBKUyB3aXRoIGBkaXNhYmxlZENsYXNzYC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBkaXNhYmxlZDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSB1c2Ugb2YgdHdvIGhhbmRsZXMuIERvdWJsZSBjaGVja2VkIGJ5IHRoZSBKUy4gQ2hhbmdlcyBzb21lIGxvZ2ljIGhhbmRsaW5nLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGRvdWJsZVNpZGVkOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBQb3RlbnRpYWwgZnV0dXJlIGZlYXR1cmUuXHJcbiAgICovXHJcbiAgLy8gc3RlcHM6IDEwMCxcclxuICAvKipcclxuICAgKiBOdW1iZXIgb2YgZGVjaW1hbCBwbGFjZXMgdGhlIHBsdWdpbiBzaG91bGQgZ28gdG8gZm9yIGZsb2F0aW5nIHBvaW50IHByZWNpc2lvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMlxyXG4gICAqL1xyXG4gIGRlY2ltYWw6IDIsXHJcbiAgLyoqXHJcbiAgICogVGltZSBkZWxheSBmb3IgZHJhZ2dlZCBlbGVtZW50cy5cclxuICAgKi9cclxuICAvLyBkcmFnRGVsYXk6IDAsXHJcbiAgLyoqXHJcbiAgICogVGltZSwgaW4gbXMsIHRvIGFuaW1hdGUgdGhlIG1vdmVtZW50IG9mIGEgc2xpZGVyIGhhbmRsZSBpZiB1c2VyIGNsaWNrcy90YXBzIG9uIHRoZSBiYXIuIE5lZWRzIHRvIGJlIG1hbnVhbGx5IHNldCBpZiB1cGRhdGluZyB0aGUgdHJhbnNpdGlvbiB0aW1lIGluIHRoZSBTYXNzIHNldHRpbmdzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAyMDBcclxuICAgKi9cclxuICBtb3ZlVGltZTogMjAwLC8vdXBkYXRlIHRoaXMgaWYgY2hhbmdpbmcgdGhlIHRyYW5zaXRpb24gdGltZSBpbiB0aGUgc2Fzc1xyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gZGlzYWJsZWQgc2xpZGVycy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2Rpc2FibGVkJ1xyXG4gICAqL1xyXG4gIGRpc2FibGVkQ2xhc3M6ICdkaXNhYmxlZCcsXHJcbiAgLyoqXHJcbiAgICogV2lsbCBpbnZlcnQgdGhlIGRlZmF1bHQgbGF5b3V0IGZvciBhIHZlcnRpY2FsPHNwYW4gZGF0YS10b29sdGlwIHRpdGxlPVwid2hvIHdvdWxkIGRvIHRoaXM/Pz9cIj4gPC9zcGFuPnNsaWRlci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBpbnZlcnRWZXJ0aWNhbDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogTWlsbGlzZWNvbmRzIGJlZm9yZSB0aGUgYGNoYW5nZWQuemYtc2xpZGVyYCBldmVudCBpcyB0cmlnZ2VyZWQgYWZ0ZXIgdmFsdWUgY2hhbmdlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MDBcclxuICAgKi9cclxuICBjaGFuZ2VkRGVsYXk6IDUwMCxcclxuICAvKipcclxuICAqIEJhc2V2YWx1ZSBmb3Igbm9uLWxpbmVhciBzbGlkZXJzXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSA1XHJcbiAgKi9cclxuICBub25MaW5lYXJCYXNlOiA1LFxyXG4gIC8qKlxyXG4gICogQmFzZXZhbHVlIGZvciBub24tbGluZWFyIHNsaWRlcnMsIHBvc3NpYmxlIHZhbHVlcyBhcmU6ICdsaW5lYXInLCAncG93JyAmICdsb2cnLiBQb3cgYW5kIExvZyB1c2UgdGhlIG5vbkxpbmVhckJhc2Ugc2V0dGluZy5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdsaW5lYXInXHJcbiAgKi9cclxuICBwb3NpdGlvblZhbHVlRnVuY3Rpb246ICdsaW5lYXInLFxyXG59O1xyXG5cclxuZnVuY3Rpb24gcGVyY2VudChmcmFjLCBudW0pIHtcclxuICByZXR1cm4gKGZyYWMgLyBudW0pO1xyXG59XHJcbmZ1bmN0aW9uIGFic1Bvc2l0aW9uKCRoYW5kbGUsIGRpciwgY2xpY2tQb3MsIHBhcmFtKSB7XHJcbiAgcmV0dXJuIE1hdGguYWJzKCgkaGFuZGxlLnBvc2l0aW9uKClbZGlyXSArICgkaGFuZGxlW3BhcmFtXSgpIC8gMikpIC0gY2xpY2tQb3MpO1xyXG59XHJcbmZ1bmN0aW9uIGJhc2VMb2coYmFzZSwgdmFsdWUpIHtcclxuICByZXR1cm4gTWF0aC5sb2codmFsdWUpL01hdGgubG9nKGJhc2UpXHJcbn1cclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFNsaWRlciwgJ1NsaWRlcicpO1xyXG5cclxufShqUXVlcnkpO1xyXG5cclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBTdGlja3kgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uc3RpY2t5XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqL1xyXG5cclxuY2xhc3MgU3RpY2t5IHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGEgc3RpY2t5IHRoaW5nLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIHN0aWNreS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIG9wdGlvbnMgb2JqZWN0IHBhc3NlZCB3aGVuIGNyZWF0aW5nIHRoZSBlbGVtZW50IHByb2dyYW1tYXRpY2FsbHkuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgU3RpY2t5LmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1N0aWNreScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIHN0aWNreSBlbGVtZW50IGJ5IGFkZGluZyBjbGFzc2VzLCBnZXR0aW5nL3NldHRpbmcgZGltZW5zaW9ucywgYnJlYWtwb2ludHMgYW5kIGF0dHJpYnV0ZXNcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyICRwYXJlbnQgPSB0aGlzLiRlbGVtZW50LnBhcmVudCgnW2RhdGEtc3RpY2t5LWNvbnRhaW5lcl0nKSxcclxuICAgICAgICBpZCA9IHRoaXMuJGVsZW1lbnRbMF0uaWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnc3RpY2t5JyksXHJcbiAgICAgICAgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGlmICghJHBhcmVudC5sZW5ndGgpIHtcclxuICAgICAgdGhpcy53YXNXcmFwcGVkID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHRoaXMuJGNvbnRhaW5lciA9ICRwYXJlbnQubGVuZ3RoID8gJHBhcmVudCA6ICQodGhpcy5vcHRpb25zLmNvbnRhaW5lcikud3JhcElubmVyKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgdGhpcy4kY29udGFpbmVyLmFkZENsYXNzKHRoaXMub3B0aW9ucy5jb250YWluZXJDbGFzcyk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuc3RpY2t5Q2xhc3MpXHJcbiAgICAgICAgICAgICAgICAgLmF0dHIoeydkYXRhLXJlc2l6ZSc6IGlkfSk7XHJcblxyXG4gICAgdGhpcy5zY3JvbGxDb3VudCA9IHRoaXMub3B0aW9ucy5jaGVja0V2ZXJ5O1xyXG4gICAgdGhpcy5pc1N0dWNrID0gZmFsc2U7XHJcbiAgICAkKHdpbmRvdykub25lKCdsb2FkLnpmLnN0aWNreScsIGZ1bmN0aW9uKCl7XHJcbiAgICAgIC8vV2UgY2FsY3VsYXRlIHRoZSBjb250YWluZXIgaGVpZ2h0IHRvIGhhdmUgY29ycmVjdCB2YWx1ZXMgZm9yIGFuY2hvciBwb2ludHMgb2Zmc2V0IGNhbGN1bGF0aW9uLlxyXG4gICAgICBfdGhpcy5jb250YWluZXJIZWlnaHQgPSBfdGhpcy4kZWxlbWVudC5jc3MoXCJkaXNwbGF5XCIpID09IFwibm9uZVwiID8gMCA6IF90aGlzLiRlbGVtZW50WzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcclxuICAgICAgX3RoaXMuJGNvbnRhaW5lci5jc3MoJ2hlaWdodCcsIF90aGlzLmNvbnRhaW5lckhlaWdodCk7XHJcbiAgICAgIF90aGlzLmVsZW1IZWlnaHQgPSBfdGhpcy5jb250YWluZXJIZWlnaHQ7XHJcbiAgICAgIGlmKF90aGlzLm9wdGlvbnMuYW5jaG9yICE9PSAnJyl7XHJcbiAgICAgICAgX3RoaXMuJGFuY2hvciA9ICQoJyMnICsgX3RoaXMub3B0aW9ucy5hbmNob3IpO1xyXG4gICAgICB9ZWxzZXtcclxuICAgICAgICBfdGhpcy5fcGFyc2VQb2ludHMoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgX3RoaXMuX3NldFNpemVzKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdmFyIHNjcm9sbCA9IHdpbmRvdy5wYWdlWU9mZnNldDtcclxuICAgICAgICBfdGhpcy5fY2FsYyhmYWxzZSwgc2Nyb2xsKTtcclxuICAgICAgICAvL1Vuc3RpY2sgdGhlIGVsZW1lbnQgd2lsbCBlbnN1cmUgdGhhdCBwcm9wZXIgY2xhc3NlcyBhcmUgc2V0LlxyXG4gICAgICAgIGlmICghX3RoaXMuaXNTdHVjaykge1xyXG4gICAgICAgICAgX3RoaXMuX3JlbW92ZVN0aWNreSgoc2Nyb2xsID49IF90aGlzLnRvcFBvaW50KSA/IGZhbHNlIDogdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgX3RoaXMuX2V2ZW50cyhpZC5zcGxpdCgnLScpLnJldmVyc2UoKS5qb2luKCctJykpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJZiB1c2luZyBtdWx0aXBsZSBlbGVtZW50cyBhcyBhbmNob3JzLCBjYWxjdWxhdGVzIHRoZSB0b3AgYW5kIGJvdHRvbSBwaXhlbCB2YWx1ZXMgdGhlIHN0aWNreSB0aGluZyBzaG91bGQgc3RpY2sgYW5kIHVuc3RpY2sgb24uXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcGFyc2VQb2ludHMoKSB7XHJcbiAgICB2YXIgdG9wID0gdGhpcy5vcHRpb25zLnRvcEFuY2hvciA9PSBcIlwiID8gMSA6IHRoaXMub3B0aW9ucy50b3BBbmNob3IsXHJcbiAgICAgICAgYnRtID0gdGhpcy5vcHRpb25zLmJ0bUFuY2hvcj09IFwiXCIgPyBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsSGVpZ2h0IDogdGhpcy5vcHRpb25zLmJ0bUFuY2hvcixcclxuICAgICAgICBwdHMgPSBbdG9wLCBidG1dLFxyXG4gICAgICAgIGJyZWFrcyA9IHt9O1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHB0cy5sZW5ndGg7IGkgPCBsZW4gJiYgcHRzW2ldOyBpKyspIHtcclxuICAgICAgdmFyIHB0O1xyXG4gICAgICBpZiAodHlwZW9mIHB0c1tpXSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICBwdCA9IHB0c1tpXTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB2YXIgcGxhY2UgPSBwdHNbaV0uc3BsaXQoJzonKSxcclxuICAgICAgICAgICAgYW5jaG9yID0gJChgIyR7cGxhY2VbMF19YCk7XHJcblxyXG4gICAgICAgIHB0ID0gYW5jaG9yLm9mZnNldCgpLnRvcDtcclxuICAgICAgICBpZiAocGxhY2VbMV0gJiYgcGxhY2VbMV0udG9Mb3dlckNhc2UoKSA9PT0gJ2JvdHRvbScpIHtcclxuICAgICAgICAgIHB0ICs9IGFuY2hvclswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrc1tpXSA9IHB0O1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICB0aGlzLnBvaW50cyA9IGJyZWFrcztcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgZm9yIHRoZSBzY3JvbGxpbmcgZWxlbWVudC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCAtIHBzdWVkby1yYW5kb20gaWQgZm9yIHVuaXF1ZSBzY3JvbGwgZXZlbnQgbGlzdGVuZXIuXHJcbiAgICovXHJcbiAgX2V2ZW50cyhpZCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICBzY3JvbGxMaXN0ZW5lciA9IHRoaXMuc2Nyb2xsTGlzdGVuZXIgPSBgc2Nyb2xsLnpmLiR7aWR9YDtcclxuICAgIGlmICh0aGlzLmlzT24pIHsgcmV0dXJuOyB9XHJcbiAgICBpZiAodGhpcy5jYW5TdGljaykge1xyXG4gICAgICB0aGlzLmlzT24gPSB0cnVlO1xyXG4gICAgICAkKHdpbmRvdykub2ZmKHNjcm9sbExpc3RlbmVyKVxyXG4gICAgICAgICAgICAgICAub24oc2Nyb2xsTGlzdGVuZXIsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgICAgICBpZiAoX3RoaXMuc2Nyb2xsQ291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgIF90aGlzLnNjcm9sbENvdW50ID0gX3RoaXMub3B0aW9ucy5jaGVja0V2ZXJ5O1xyXG4gICAgICAgICAgICAgICAgICAgX3RoaXMuX3NldFNpemVzKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICBfdGhpcy5fY2FsYyhmYWxzZSwgd2luZG93LnBhZ2VZT2Zmc2V0KTtcclxuICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICBfdGhpcy5zY3JvbGxDb3VudC0tO1xyXG4gICAgICAgICAgICAgICAgICAgX3RoaXMuX2NhbGMoZmFsc2UsIHdpbmRvdy5wYWdlWU9mZnNldCk7XHJcbiAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCdyZXNpemVtZS56Zi50cmlnZ2VyJylcclxuICAgICAgICAgICAgICAgICAub24oJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInLCBmdW5jdGlvbihlLCBlbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICBfdGhpcy5fc2V0U2l6ZXMoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2NhbGMoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgIGlmIChfdGhpcy5jYW5TdGljaykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFfdGhpcy5pc09uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9ldmVudHMoaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoX3RoaXMuaXNPbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3BhdXNlTGlzdGVuZXJzKHNjcm9sbExpc3RlbmVyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmVzIGV2ZW50IGhhbmRsZXJzIGZvciBzY3JvbGwgYW5kIGNoYW5nZSBldmVudHMgb24gYW5jaG9yLlxyXG4gICAqIEBmaXJlcyBTdGlja3kjcGF1c2VcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2Nyb2xsTGlzdGVuZXIgLSB1bmlxdWUsIG5hbWVzcGFjZWQgc2Nyb2xsIGxpc3RlbmVyIGF0dGFjaGVkIHRvIGB3aW5kb3dgXHJcbiAgICovXHJcbiAgX3BhdXNlTGlzdGVuZXJzKHNjcm9sbExpc3RlbmVyKSB7XHJcbiAgICB0aGlzLmlzT24gPSBmYWxzZTtcclxuICAgICQod2luZG93KS5vZmYoc2Nyb2xsTGlzdGVuZXIpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgcGx1Z2luIGlzIHBhdXNlZCBkdWUgdG8gcmVzaXplIGV2ZW50IHNocmlua2luZyB0aGUgdmlldy5cclxuICAgICAqIEBldmVudCBTdGlja3kjcGF1c2VcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3BhdXNlLnpmLnN0aWNreScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsbGVkIG9uIGV2ZXJ5IGBzY3JvbGxgIGV2ZW50IGFuZCBvbiBgX2luaXRgXHJcbiAgICogZmlyZXMgZnVuY3Rpb25zIGJhc2VkIG9uIGJvb2xlYW5zIGFuZCBjYWNoZWQgdmFsdWVzXHJcbiAgICogQHBhcmFtIHtCb29sZWFufSBjaGVja1NpemVzIC0gdHJ1ZSBpZiBwbHVnaW4gc2hvdWxkIHJlY2FsY3VsYXRlIHNpemVzIGFuZCBicmVha3BvaW50cy5cclxuICAgKiBAcGFyYW0ge051bWJlcn0gc2Nyb2xsIC0gY3VycmVudCBzY3JvbGwgcG9zaXRpb24gcGFzc2VkIGZyb20gc2Nyb2xsIGV2ZW50IGNiIGZ1bmN0aW9uLiBJZiBub3QgcGFzc2VkLCBkZWZhdWx0cyB0byBgd2luZG93LnBhZ2VZT2Zmc2V0YC5cclxuICAgKi9cclxuICBfY2FsYyhjaGVja1NpemVzLCBzY3JvbGwpIHtcclxuICAgIGlmIChjaGVja1NpemVzKSB7IHRoaXMuX3NldFNpemVzKCk7IH1cclxuXHJcbiAgICBpZiAoIXRoaXMuY2FuU3RpY2spIHtcclxuICAgICAgaWYgKHRoaXMuaXNTdHVjaykge1xyXG4gICAgICAgIHRoaXMuX3JlbW92ZVN0aWNreSh0cnVlKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFzY3JvbGwpIHsgc2Nyb2xsID0gd2luZG93LnBhZ2VZT2Zmc2V0OyB9XHJcblxyXG4gICAgaWYgKHNjcm9sbCA+PSB0aGlzLnRvcFBvaW50KSB7XHJcbiAgICAgIGlmIChzY3JvbGwgPD0gdGhpcy5ib3R0b21Qb2ludCkge1xyXG4gICAgICAgIGlmICghdGhpcy5pc1N0dWNrKSB7XHJcbiAgICAgICAgICB0aGlzLl9zZXRTdGlja3koKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNTdHVjaykge1xyXG4gICAgICAgICAgdGhpcy5fcmVtb3ZlU3RpY2t5KGZhbHNlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICh0aGlzLmlzU3R1Y2spIHtcclxuICAgICAgICB0aGlzLl9yZW1vdmVTdGlja3kodHJ1ZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhdXNlcyB0aGUgJGVsZW1lbnQgdG8gYmVjb21lIHN0dWNrLlxyXG4gICAqIEFkZHMgYHBvc2l0aW9uOiBmaXhlZDtgLCBhbmQgaGVscGVyIGNsYXNzZXMuXHJcbiAgICogQGZpcmVzIFN0aWNreSNzdHVja3RvXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc2V0U3RpY2t5KCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICBzdGlja1RvID0gdGhpcy5vcHRpb25zLnN0aWNrVG8sXHJcbiAgICAgICAgbXJnbiA9IHN0aWNrVG8gPT09ICd0b3AnID8gJ21hcmdpblRvcCcgOiAnbWFyZ2luQm90dG9tJyxcclxuICAgICAgICBub3RTdHVja1RvID0gc3RpY2tUbyA9PT0gJ3RvcCcgPyAnYm90dG9tJyA6ICd0b3AnLFxyXG4gICAgICAgIGNzcyA9IHt9O1xyXG5cclxuICAgIGNzc1ttcmduXSA9IGAke3RoaXMub3B0aW9uc1ttcmduXX1lbWA7XHJcbiAgICBjc3Nbc3RpY2tUb10gPSAwO1xyXG4gICAgY3NzW25vdFN0dWNrVG9dID0gJ2F1dG8nO1xyXG4gICAgdGhpcy5pc1N0dWNrID0gdHJ1ZTtcclxuICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MoYGlzLWFuY2hvcmVkIGlzLWF0LSR7bm90U3R1Y2tUb31gKVxyXG4gICAgICAgICAgICAgICAgIC5hZGRDbGFzcyhgaXMtc3R1Y2sgaXMtYXQtJHtzdGlja1RvfWApXHJcbiAgICAgICAgICAgICAgICAgLmNzcyhjc3MpXHJcbiAgICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgJGVsZW1lbnQgaGFzIGJlY29tZSBgcG9zaXRpb246IGZpeGVkO2BcclxuICAgICAgICAgICAgICAgICAgKiBOYW1lc3BhY2VkIHRvIGB0b3BgIG9yIGBib3R0b21gLCBlLmcuIGBzdGlja3kuemYuc3R1Y2t0bzp0b3BgXHJcbiAgICAgICAgICAgICAgICAgICogQGV2ZW50IFN0aWNreSNzdHVja3RvXHJcbiAgICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICAgLnRyaWdnZXIoYHN0aWNreS56Zi5zdHVja3RvOiR7c3RpY2tUb31gKTtcclxuICAgIHRoaXMuJGVsZW1lbnQub24oXCJ0cmFuc2l0aW9uZW5kIHdlYmtpdFRyYW5zaXRpb25FbmQgb1RyYW5zaXRpb25FbmQgb3RyYW5zaXRpb25lbmQgTVNUcmFuc2l0aW9uRW5kXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBfdGhpcy5fc2V0U2l6ZXMoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2F1c2VzIHRoZSAkZWxlbWVudCB0byBiZWNvbWUgdW5zdHVjay5cclxuICAgKiBSZW1vdmVzIGBwb3NpdGlvbjogZml4ZWQ7YCwgYW5kIGhlbHBlciBjbGFzc2VzLlxyXG4gICAqIEFkZHMgb3RoZXIgaGVscGVyIGNsYXNzZXMuXHJcbiAgICogQHBhcmFtIHtCb29sZWFufSBpc1RvcCAtIHRlbGxzIHRoZSBmdW5jdGlvbiBpZiB0aGUgJGVsZW1lbnQgc2hvdWxkIGFuY2hvciB0byB0aGUgdG9wIG9yIGJvdHRvbSBvZiBpdHMgJGFuY2hvciBlbGVtZW50LlxyXG4gICAqIEBmaXJlcyBTdGlja3kjdW5zdHVja2Zyb21cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9yZW1vdmVTdGlja3koaXNUb3ApIHtcclxuICAgIHZhciBzdGlja1RvID0gdGhpcy5vcHRpb25zLnN0aWNrVG8sXHJcbiAgICAgICAgc3RpY2tUb1RvcCA9IHN0aWNrVG8gPT09ICd0b3AnLFxyXG4gICAgICAgIGNzcyA9IHt9LFxyXG4gICAgICAgIGFuY2hvclB0ID0gKHRoaXMucG9pbnRzID8gdGhpcy5wb2ludHNbMV0gLSB0aGlzLnBvaW50c1swXSA6IHRoaXMuYW5jaG9ySGVpZ2h0KSAtIHRoaXMuZWxlbUhlaWdodCxcclxuICAgICAgICBtcmduID0gc3RpY2tUb1RvcCA/ICdtYXJnaW5Ub3AnIDogJ21hcmdpbkJvdHRvbScsXHJcbiAgICAgICAgbm90U3R1Y2tUbyA9IHN0aWNrVG9Ub3AgPyAnYm90dG9tJyA6ICd0b3AnLFxyXG4gICAgICAgIHRvcE9yQm90dG9tID0gaXNUb3AgPyAndG9wJyA6ICdib3R0b20nO1xyXG5cclxuICAgIGNzc1ttcmduXSA9IDA7XHJcblxyXG4gICAgY3NzWydib3R0b20nXSA9ICdhdXRvJztcclxuICAgIGlmKGlzVG9wKSB7XHJcbiAgICAgIGNzc1sndG9wJ10gPSAwO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY3NzWyd0b3AnXSA9IGFuY2hvclB0O1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaXNTdHVjayA9IGZhbHNlO1xyXG4gICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhgaXMtc3R1Y2sgaXMtYXQtJHtzdGlja1RvfWApXHJcbiAgICAgICAgICAgICAgICAgLmFkZENsYXNzKGBpcy1hbmNob3JlZCBpcy1hdC0ke3RvcE9yQm90dG9tfWApXHJcbiAgICAgICAgICAgICAgICAgLmNzcyhjc3MpXHJcbiAgICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgJGVsZW1lbnQgaGFzIGJlY29tZSBhbmNob3JlZC5cclxuICAgICAgICAgICAgICAgICAgKiBOYW1lc3BhY2VkIHRvIGB0b3BgIG9yIGBib3R0b21gLCBlLmcuIGBzdGlja3kuemYudW5zdHVja2Zyb206Ym90dG9tYFxyXG4gICAgICAgICAgICAgICAgICAqIEBldmVudCBTdGlja3kjdW5zdHVja2Zyb21cclxuICAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgICAudHJpZ2dlcihgc3RpY2t5LnpmLnVuc3R1Y2tmcm9tOiR7dG9wT3JCb3R0b219YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSAkZWxlbWVudCBhbmQgJGNvbnRhaW5lciBzaXplcyBmb3IgcGx1Z2luLlxyXG4gICAqIENhbGxzIGBfc2V0QnJlYWtQb2ludHNgLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gb3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gdG8gZmlyZSBvbiBjb21wbGV0aW9uIG9mIGBfc2V0QnJlYWtQb2ludHNgLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3NldFNpemVzKGNiKSB7XHJcbiAgICB0aGlzLmNhblN0aWNrID0gRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LmlzKHRoaXMub3B0aW9ucy5zdGlja3lPbik7XHJcbiAgICBpZiAoIXRoaXMuY2FuU3RpY2spIHtcclxuICAgICAgaWYgKGNiICYmIHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgeyBjYigpOyB9XHJcbiAgICB9XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgIG5ld0VsZW1XaWR0aCA9IHRoaXMuJGNvbnRhaW5lclswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aCxcclxuICAgICAgICBjb21wID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUodGhpcy4kY29udGFpbmVyWzBdKSxcclxuICAgICAgICBwZG5nbCA9IHBhcnNlSW50KGNvbXBbJ3BhZGRpbmctbGVmdCddLCAxMCksXHJcbiAgICAgICAgcGRuZ3IgPSBwYXJzZUludChjb21wWydwYWRkaW5nLXJpZ2h0J10sIDEwKTtcclxuXHJcbiAgICBpZiAodGhpcy4kYW5jaG9yICYmIHRoaXMuJGFuY2hvci5sZW5ndGgpIHtcclxuICAgICAgdGhpcy5hbmNob3JIZWlnaHQgPSB0aGlzLiRhbmNob3JbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5fcGFyc2VQb2ludHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmNzcyh7XHJcbiAgICAgICdtYXgtd2lkdGgnOiBgJHtuZXdFbGVtV2lkdGggLSBwZG5nbCAtIHBkbmdyfXB4YFxyXG4gICAgfSk7XHJcblxyXG4gICAgdmFyIG5ld0NvbnRhaW5lckhlaWdodCA9IHRoaXMuJGVsZW1lbnRbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IHx8IHRoaXMuY29udGFpbmVySGVpZ2h0O1xyXG4gICAgaWYgKHRoaXMuJGVsZW1lbnQuY3NzKFwiZGlzcGxheVwiKSA9PSBcIm5vbmVcIikge1xyXG4gICAgICBuZXdDb250YWluZXJIZWlnaHQgPSAwO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jb250YWluZXJIZWlnaHQgPSBuZXdDb250YWluZXJIZWlnaHQ7XHJcbiAgICB0aGlzLiRjb250YWluZXIuY3NzKHtcclxuICAgICAgaGVpZ2h0OiBuZXdDb250YWluZXJIZWlnaHRcclxuICAgIH0pO1xyXG4gICAgdGhpcy5lbGVtSGVpZ2h0ID0gbmV3Q29udGFpbmVySGVpZ2h0O1xyXG5cclxuICAgIGlmICghdGhpcy5pc1N0dWNrKSB7XHJcbiAgICAgIGlmICh0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1hdC1ib3R0b20nKSkge1xyXG4gICAgICAgIHZhciBhbmNob3JQdCA9ICh0aGlzLnBvaW50cyA/IHRoaXMucG9pbnRzWzFdIC0gdGhpcy4kY29udGFpbmVyLm9mZnNldCgpLnRvcCA6IHRoaXMuYW5jaG9ySGVpZ2h0KSAtIHRoaXMuZWxlbUhlaWdodDtcclxuICAgICAgICB0aGlzLiRlbGVtZW50LmNzcygndG9wJywgYW5jaG9yUHQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fc2V0QnJlYWtQb2ludHMobmV3Q29udGFpbmVySGVpZ2h0LCBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKGNiICYmIHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgeyBjYigpOyB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHVwcGVyIGFuZCBsb3dlciBicmVha3BvaW50cyBmb3IgdGhlIGVsZW1lbnQgdG8gYmVjb21lIHN0aWNreS91bnN0aWNreS5cclxuICAgKiBAcGFyYW0ge051bWJlcn0gZWxlbUhlaWdodCAtIHB4IHZhbHVlIGZvciBzdGlja3kuJGVsZW1lbnQgaGVpZ2h0LCBjYWxjdWxhdGVkIGJ5IGBfc2V0U2l6ZXNgLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIC0gb3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIG9uIGNvbXBsZXRpb24uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc2V0QnJlYWtQb2ludHMoZWxlbUhlaWdodCwgY2IpIHtcclxuICAgIGlmICghdGhpcy5jYW5TdGljaykge1xyXG4gICAgICBpZiAoY2IgJiYgdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7IGNiKCk7IH1cclxuICAgICAgZWxzZSB7IHJldHVybiBmYWxzZTsgfVxyXG4gICAgfVxyXG4gICAgdmFyIG1Ub3AgPSBlbUNhbGModGhpcy5vcHRpb25zLm1hcmdpblRvcCksXHJcbiAgICAgICAgbUJ0bSA9IGVtQ2FsYyh0aGlzLm9wdGlvbnMubWFyZ2luQm90dG9tKSxcclxuICAgICAgICB0b3BQb2ludCA9IHRoaXMucG9pbnRzID8gdGhpcy5wb2ludHNbMF0gOiB0aGlzLiRhbmNob3Iub2Zmc2V0KCkudG9wLFxyXG4gICAgICAgIGJvdHRvbVBvaW50ID0gdGhpcy5wb2ludHMgPyB0aGlzLnBvaW50c1sxXSA6IHRvcFBvaW50ICsgdGhpcy5hbmNob3JIZWlnaHQsXHJcbiAgICAgICAgLy8gdG9wUG9pbnQgPSB0aGlzLiRhbmNob3Iub2Zmc2V0KCkudG9wIHx8IHRoaXMucG9pbnRzWzBdLFxyXG4gICAgICAgIC8vIGJvdHRvbVBvaW50ID0gdG9wUG9pbnQgKyB0aGlzLmFuY2hvckhlaWdodCB8fCB0aGlzLnBvaW50c1sxXSxcclxuICAgICAgICB3aW5IZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdGlja1RvID09PSAndG9wJykge1xyXG4gICAgICB0b3BQb2ludCAtPSBtVG9wO1xyXG4gICAgICBib3R0b21Qb2ludCAtPSAoZWxlbUhlaWdodCArIG1Ub3ApO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuc3RpY2tUbyA9PT0gJ2JvdHRvbScpIHtcclxuICAgICAgdG9wUG9pbnQgLT0gKHdpbkhlaWdodCAtIChlbGVtSGVpZ2h0ICsgbUJ0bSkpO1xyXG4gICAgICBib3R0b21Qb2ludCAtPSAod2luSGVpZ2h0IC0gbUJ0bSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvL3RoaXMgd291bGQgYmUgdGhlIHN0aWNrVG86IGJvdGggb3B0aW9uLi4uIHRyaWNreVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudG9wUG9pbnQgPSB0b3BQb2ludDtcclxuICAgIHRoaXMuYm90dG9tUG9pbnQgPSBib3R0b21Qb2ludDtcclxuXHJcbiAgICBpZiAoY2IgJiYgdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7IGNiKCk7IH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBjdXJyZW50IHN0aWNreSBlbGVtZW50LlxyXG4gICAqIFJlc2V0cyB0aGUgZWxlbWVudCB0byB0aGUgdG9wIHBvc2l0aW9uIGZpcnN0LlxyXG4gICAqIFJlbW92ZXMgZXZlbnQgbGlzdGVuZXJzLCBKUy1hZGRlZCBjc3MgcHJvcGVydGllcyBhbmQgY2xhc3NlcywgYW5kIHVud3JhcHMgdGhlICRlbGVtZW50IGlmIHRoZSBKUyBhZGRlZCB0aGUgJGNvbnRhaW5lci5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy5fcmVtb3ZlU3RpY2t5KHRydWUpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MoYCR7dGhpcy5vcHRpb25zLnN0aWNreUNsYXNzfSBpcy1hbmNob3JlZCBpcy1hdC10b3BgKVxyXG4gICAgICAgICAgICAgICAgIC5jc3Moe1xyXG4gICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnJyxcclxuICAgICAgICAgICAgICAgICAgIHRvcDogJycsXHJcbiAgICAgICAgICAgICAgICAgICBib3R0b206ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgJ21heC13aWR0aCc6ICcnXHJcbiAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAub2ZmKCdyZXNpemVtZS56Zi50cmlnZ2VyJyk7XHJcbiAgICBpZiAodGhpcy4kYW5jaG9yICYmIHRoaXMuJGFuY2hvci5sZW5ndGgpIHtcclxuICAgICAgdGhpcy4kYW5jaG9yLm9mZignY2hhbmdlLnpmLnN0aWNreScpO1xyXG4gICAgfVxyXG4gICAgJCh3aW5kb3cpLm9mZih0aGlzLnNjcm9sbExpc3RlbmVyKTtcclxuXHJcbiAgICBpZiAodGhpcy53YXNXcmFwcGVkKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudW53cmFwKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLiRjb250YWluZXIucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmNvbnRhaW5lckNsYXNzKVxyXG4gICAgICAgICAgICAgICAgICAgICAuY3NzKHtcclxuICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6ICcnXHJcbiAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuU3RpY2t5LmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIEN1c3RvbWl6YWJsZSBjb250YWluZXIgdGVtcGxhdGUuIEFkZCB5b3VyIG93biBjbGFzc2VzIGZvciBzdHlsaW5nIGFuZCBzaXppbmcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICcmbHQ7ZGl2IGRhdGEtc3RpY2t5LWNvbnRhaW5lciBjbGFzcz1cInNtYWxsLTYgY29sdW1uc1wiJmd0OyZsdDsvZGl2Jmd0OydcclxuICAgKi9cclxuICBjb250YWluZXI6ICc8ZGl2IGRhdGEtc3RpY2t5LWNvbnRhaW5lcj48L2Rpdj4nLFxyXG4gIC8qKlxyXG4gICAqIExvY2F0aW9uIGluIHRoZSB2aWV3IHRoZSBlbGVtZW50IHN0aWNrcyB0by5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3RvcCdcclxuICAgKi9cclxuICBzdGlja1RvOiAndG9wJyxcclxuICAvKipcclxuICAgKiBJZiBhbmNob3JlZCB0byBhIHNpbmdsZSBlbGVtZW50LCB0aGUgaWQgb2YgdGhhdCBlbGVtZW50LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnZXhhbXBsZUlkJ1xyXG4gICAqL1xyXG4gIGFuY2hvcjogJycsXHJcbiAgLyoqXHJcbiAgICogSWYgdXNpbmcgbW9yZSB0aGFuIG9uZSBlbGVtZW50IGFzIGFuY2hvciBwb2ludHMsIHRoZSBpZCBvZiB0aGUgdG9wIGFuY2hvci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2V4YW1wbGVJZDp0b3AnXHJcbiAgICovXHJcbiAgdG9wQW5jaG9yOiAnJyxcclxuICAvKipcclxuICAgKiBJZiB1c2luZyBtb3JlIHRoYW4gb25lIGVsZW1lbnQgYXMgYW5jaG9yIHBvaW50cywgdGhlIGlkIG9mIHRoZSBib3R0b20gYW5jaG9yLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnZXhhbXBsZUlkOmJvdHRvbSdcclxuICAgKi9cclxuICBidG1BbmNob3I6ICcnLFxyXG4gIC8qKlxyXG4gICAqIE1hcmdpbiwgaW4gYGVtYCdzIHRvIGFwcGx5IHRvIHRoZSB0b3Agb2YgdGhlIGVsZW1lbnQgd2hlbiBpdCBiZWNvbWVzIHN0aWNreS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMVxyXG4gICAqL1xyXG4gIG1hcmdpblRvcDogMSxcclxuICAvKipcclxuICAgKiBNYXJnaW4sIGluIGBlbWAncyB0byBhcHBseSB0byB0aGUgYm90dG9tIG9mIHRoZSBlbGVtZW50IHdoZW4gaXQgYmVjb21lcyBzdGlja3kuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDFcclxuICAgKi9cclxuICBtYXJnaW5Cb3R0b206IDEsXHJcbiAgLyoqXHJcbiAgICogQnJlYWtwb2ludCBzdHJpbmcgdGhhdCBpcyB0aGUgbWluaW11bSBzY3JlZW4gc2l6ZSBhbiBlbGVtZW50IHNob3VsZCBiZWNvbWUgc3RpY2t5LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnbWVkaXVtJ1xyXG4gICAqL1xyXG4gIHN0aWNreU9uOiAnbWVkaXVtJyxcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHN0aWNreSBlbGVtZW50LCBhbmQgcmVtb3ZlZCBvbiBkZXN0cnVjdGlvbi4gRm91bmRhdGlvbiBkZWZhdWx0cyB0byBgc3RpY2t5YC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3N0aWNreSdcclxuICAgKi9cclxuICBzdGlja3lDbGFzczogJ3N0aWNreScsXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byBzdGlja3kgY29udGFpbmVyLiBGb3VuZGF0aW9uIGRlZmF1bHRzIHRvIGBzdGlja3ktY29udGFpbmVyYC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3N0aWNreS1jb250YWluZXInXHJcbiAgICovXHJcbiAgY29udGFpbmVyQ2xhc3M6ICdzdGlja3ktY29udGFpbmVyJyxcclxuICAvKipcclxuICAgKiBOdW1iZXIgb2Ygc2Nyb2xsIGV2ZW50cyBiZXR3ZWVuIHRoZSBwbHVnaW4ncyByZWNhbGN1bGF0aW5nIHN0aWNreSBwb2ludHMuIFNldHRpbmcgaXQgdG8gYDBgIHdpbGwgY2F1c2UgaXQgdG8gcmVjYWxjIGV2ZXJ5IHNjcm9sbCBldmVudCwgc2V0dGluZyBpdCB0byBgLTFgIHdpbGwgcHJldmVudCByZWNhbGMgb24gc2Nyb2xsLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSA1MFxyXG4gICAqL1xyXG4gIGNoZWNrRXZlcnk6IC0xXHJcbn07XHJcblxyXG4vKipcclxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGNhbGN1bGF0ZSBlbSB2YWx1ZXNcclxuICogQHBhcmFtIE51bWJlciB7ZW19IC0gbnVtYmVyIG9mIGVtJ3MgdG8gY2FsY3VsYXRlIGludG8gcGl4ZWxzXHJcbiAqL1xyXG5mdW5jdGlvbiBlbUNhbGMoZW0pIHtcclxuICByZXR1cm4gcGFyc2VJbnQod2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuYm9keSwgbnVsbCkuZm9udFNpemUsIDEwKSAqIGVtO1xyXG59XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihTdGlja3ksICdTdGlja3knKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBUYWJzIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnRhYnNcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRpbWVyQW5kSW1hZ2VMb2FkZXIgaWYgdGFicyBjb250YWluIGltYWdlc1xyXG4gKi9cclxuXHJcbmNsYXNzIFRhYnMge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgdGFicy5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgVGFicyNpbml0XHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byB0YWJzLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBUYWJzLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnVGFicycpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignVGFicycsIHtcclxuICAgICAgJ0VOVEVSJzogJ29wZW4nLFxyXG4gICAgICAnU1BBQ0UnOiAnb3BlbicsXHJcbiAgICAgICdBUlJPV19SSUdIVCc6ICduZXh0JyxcclxuICAgICAgJ0FSUk9XX1VQJzogJ3ByZXZpb3VzJyxcclxuICAgICAgJ0FSUk9XX0RPV04nOiAnbmV4dCcsXHJcbiAgICAgICdBUlJPV19MRUZUJzogJ3ByZXZpb3VzJ1xyXG4gICAgICAvLyAnVEFCJzogJ25leHQnLFxyXG4gICAgICAvLyAnU0hJRlRfVEFCJzogJ3ByZXZpb3VzJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgdGFicyBieSBzaG93aW5nIGFuZCBmb2N1c2luZyAoaWYgYXV0b0ZvY3VzPXRydWUpIHRoZSBwcmVzZXQgYWN0aXZlIHRhYi5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoeydyb2xlJzogJ3RhYmxpc3QnfSk7XHJcbiAgICB0aGlzLiR0YWJUaXRsZXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoYC4ke3RoaXMub3B0aW9ucy5saW5rQ2xhc3N9YCk7XHJcbiAgICB0aGlzLiR0YWJDb250ZW50ID0gJChgW2RhdGEtdGFicy1jb250ZW50PVwiJHt0aGlzLiRlbGVtZW50WzBdLmlkfVwiXWApO1xyXG5cclxuICAgIHRoaXMuJHRhYlRpdGxlcy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciAkZWxlbSA9ICQodGhpcyksXHJcbiAgICAgICAgICAkbGluayA9ICRlbGVtLmZpbmQoJ2EnKSxcclxuICAgICAgICAgIGlzQWN0aXZlID0gJGVsZW0uaGFzQ2xhc3MoYCR7X3RoaXMub3B0aW9ucy5saW5rQWN0aXZlQ2xhc3N9YCksXHJcbiAgICAgICAgICBoYXNoID0gJGxpbmtbMF0uaGFzaC5zbGljZSgxKSxcclxuICAgICAgICAgIGxpbmtJZCA9ICRsaW5rWzBdLmlkID8gJGxpbmtbMF0uaWQgOiBgJHtoYXNofS1sYWJlbGAsXHJcbiAgICAgICAgICAkdGFiQ29udGVudCA9ICQoYCMke2hhc2h9YCk7XHJcblxyXG4gICAgICAkZWxlbS5hdHRyKHsncm9sZSc6ICdwcmVzZW50YXRpb24nfSk7XHJcblxyXG4gICAgICAkbGluay5hdHRyKHtcclxuICAgICAgICAncm9sZSc6ICd0YWInLFxyXG4gICAgICAgICdhcmlhLWNvbnRyb2xzJzogaGFzaCxcclxuICAgICAgICAnYXJpYS1zZWxlY3RlZCc6IGlzQWN0aXZlLFxyXG4gICAgICAgICdpZCc6IGxpbmtJZFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgICR0YWJDb250ZW50LmF0dHIoe1xyXG4gICAgICAgICdyb2xlJzogJ3RhYnBhbmVsJyxcclxuICAgICAgICAnYXJpYS1oaWRkZW4nOiAhaXNBY3RpdmUsXHJcbiAgICAgICAgJ2FyaWEtbGFiZWxsZWRieSc6IGxpbmtJZFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmKGlzQWN0aXZlICYmIF90aGlzLm9wdGlvbnMuYXV0b0ZvY3VzKXtcclxuICAgICAgICAkKHdpbmRvdykubG9hZChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKHsgc2Nyb2xsVG9wOiAkZWxlbS5vZmZzZXQoKS50b3AgfSwgX3RoaXMub3B0aW9ucy5kZWVwTGlua1NtdWRnZURlbGF5LCAoKSA9PiB7XHJcbiAgICAgICAgICAgICRsaW5rLmZvY3VzKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy91c2UgYnJvd3NlciB0byBvcGVuIGEgdGFiLCBpZiBpdCBleGlzdHMgaW4gdGhpcyB0YWJzZXRcclxuICAgICAgaWYgKF90aGlzLm9wdGlvbnMuZGVlcExpbmspIHtcclxuICAgICAgICB2YXIgYW5jaG9yID0gd2luZG93LmxvY2F0aW9uLmhhc2g7XHJcbiAgICAgICAgLy9uZWVkIGEgaGFzaCBhbmQgYSByZWxldmFudCBhbmNob3IgaW4gdGhpcyB0YWJzZXRcclxuICAgICAgICBpZihhbmNob3IubGVuZ3RoKSB7XHJcbiAgICAgICAgICB2YXIgJGxpbmsgPSAkZWxlbS5maW5kKCdbaHJlZj1cIicrYW5jaG9yKydcIl0nKTtcclxuICAgICAgICAgIGlmICgkbGluay5sZW5ndGgpIHtcclxuICAgICAgICAgICAgX3RoaXMuc2VsZWN0VGFiKCQoYW5jaG9yKSk7XHJcblxyXG4gICAgICAgICAgICAvL3JvbGwgdXAgYSBsaXR0bGUgdG8gc2hvdyB0aGUgdGl0bGVzXHJcbiAgICAgICAgICAgIGlmIChfdGhpcy5vcHRpb25zLmRlZXBMaW5rU211ZGdlKSB7XHJcbiAgICAgICAgICAgICAgJCh3aW5kb3cpLmxvYWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgb2Zmc2V0ID0gJGVsZW0ub2Zmc2V0KCk7XHJcbiAgICAgICAgICAgICAgICAkKCdodG1sLCBib2R5JykuYW5pbWF0ZSh7IHNjcm9sbFRvcDogb2Zmc2V0LnRvcCB9LCBfdGhpcy5vcHRpb25zLmRlZXBMaW5rU211ZGdlRGVsYXkpO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIHpwbHVnaW4gaGFzIGRlZXBsaW5rZWQgYXQgcGFnZWxvYWRcclxuICAgICAgICAgICAgICAqIEBldmVudCBUYWJzI2RlZXBsaW5rXHJcbiAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICRlbGVtLnRyaWdnZXIoJ2RlZXBsaW5rLnpmLnRhYnMnLCBbJGxpbmssICQoYW5jaG9yKV0pO1xyXG4gICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGlmKHRoaXMub3B0aW9ucy5tYXRjaEhlaWdodCkge1xyXG4gICAgICB2YXIgJGltYWdlcyA9IHRoaXMuJHRhYkNvbnRlbnQuZmluZCgnaW1nJyk7XHJcblxyXG4gICAgICBpZiAoJGltYWdlcy5sZW5ndGgpIHtcclxuICAgICAgICBGb3VuZGF0aW9uLm9uSW1hZ2VzTG9hZGVkKCRpbWFnZXMsIHRoaXMuX3NldEhlaWdodC5iaW5kKHRoaXMpKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLl9zZXRIZWlnaHQoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyBmb3IgaXRlbXMgd2l0aGluIHRoZSB0YWJzLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHRoaXMuX2FkZEtleUhhbmRsZXIoKTtcclxuICAgIHRoaXMuX2FkZENsaWNrSGFuZGxlcigpO1xyXG4gICAgdGhpcy5fc2V0SGVpZ2h0TXFIYW5kbGVyID0gbnVsbDtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLm1hdGNoSGVpZ2h0KSB7XHJcbiAgICAgIHRoaXMuX3NldEhlaWdodE1xSGFuZGxlciA9IHRoaXMuX3NldEhlaWdodC5iaW5kKHRoaXMpO1xyXG5cclxuICAgICAgJCh3aW5kb3cpLm9uKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCB0aGlzLl9zZXRIZWlnaHRNcUhhbmRsZXIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBjbGljayBoYW5kbGVycyBmb3IgaXRlbXMgd2l0aGluIHRoZSB0YWJzLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2FkZENsaWNrSGFuZGxlcigpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAub2ZmKCdjbGljay56Zi50YWJzJylcclxuICAgICAgLm9uKCdjbGljay56Zi50YWJzJywgYC4ke3RoaXMub3B0aW9ucy5saW5rQ2xhc3N9YCwgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgX3RoaXMuX2hhbmRsZVRhYkNoYW5nZSgkKHRoaXMpKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGtleWJvYXJkIGV2ZW50IGhhbmRsZXJzIGZvciBpdGVtcyB3aXRoaW4gdGhlIHRhYnMuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfYWRkS2V5SGFuZGxlcigpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kdGFiVGl0bGVzLm9mZigna2V5ZG93bi56Zi50YWJzJykub24oJ2tleWRvd24uemYudGFicycsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICBpZiAoZS53aGljaCA9PT0gOSkgcmV0dXJuO1xyXG5cclxuXHJcbiAgICAgIHZhciAkZWxlbWVudCA9ICQodGhpcyksXHJcbiAgICAgICAgJGVsZW1lbnRzID0gJGVsZW1lbnQucGFyZW50KCd1bCcpLmNoaWxkcmVuKCdsaScpLFxyXG4gICAgICAgICRwcmV2RWxlbWVudCxcclxuICAgICAgICAkbmV4dEVsZW1lbnQ7XHJcblxyXG4gICAgICAkZWxlbWVudHMuZWFjaChmdW5jdGlvbihpKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykuaXMoJGVsZW1lbnQpKSB7XHJcbiAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy53cmFwT25LZXlzKSB7XHJcbiAgICAgICAgICAgICRwcmV2RWxlbWVudCA9IGkgPT09IDAgPyAkZWxlbWVudHMubGFzdCgpIDogJGVsZW1lbnRzLmVxKGktMSk7XHJcbiAgICAgICAgICAgICRuZXh0RWxlbWVudCA9IGkgPT09ICRlbGVtZW50cy5sZW5ndGggLTEgPyAkZWxlbWVudHMuZmlyc3QoKSA6ICRlbGVtZW50cy5lcShpKzEpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgJHByZXZFbGVtZW50ID0gJGVsZW1lbnRzLmVxKE1hdGgubWF4KDAsIGktMSkpO1xyXG4gICAgICAgICAgICAkbmV4dEVsZW1lbnQgPSAkZWxlbWVudHMuZXEoTWF0aC5taW4oaSsxLCAkZWxlbWVudHMubGVuZ3RoLTEpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gaGFuZGxlIGtleWJvYXJkIGV2ZW50IHdpdGgga2V5Ym9hcmQgdXRpbFxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnVGFicycsIHtcclxuICAgICAgICBvcGVuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICRlbGVtZW50LmZpbmQoJ1tyb2xlPVwidGFiXCJdJykuZm9jdXMoKTtcclxuICAgICAgICAgIF90aGlzLl9oYW5kbGVUYWJDaGFuZ2UoJGVsZW1lbnQpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcHJldmlvdXM6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJHByZXZFbGVtZW50LmZpbmQoJ1tyb2xlPVwidGFiXCJdJykuZm9jdXMoKTtcclxuICAgICAgICAgIF90aGlzLl9oYW5kbGVUYWJDaGFuZ2UoJHByZXZFbGVtZW50KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJG5leHRFbGVtZW50LmZpbmQoJ1tyb2xlPVwidGFiXCJdJykuZm9jdXMoKTtcclxuICAgICAgICAgIF90aGlzLl9oYW5kbGVUYWJDaGFuZ2UoJG5leHRFbGVtZW50KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyB0aGUgdGFiIGAkdGFyZ2V0Q29udGVudGAgZGVmaW5lZCBieSBgJHRhcmdldGAuIENvbGxhcHNlcyBhY3RpdmUgdGFiLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gVGFiIHRvIG9wZW4uXHJcbiAgICogQGZpcmVzIFRhYnMjY2hhbmdlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgX2hhbmRsZVRhYkNoYW5nZSgkdGFyZ2V0KSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVjayBmb3IgYWN0aXZlIGNsYXNzIG9uIHRhcmdldC4gQ29sbGFwc2UgaWYgZXhpc3RzLlxyXG4gICAgICovXHJcbiAgICBpZiAoJHRhcmdldC5oYXNDbGFzcyhgJHt0aGlzLm9wdGlvbnMubGlua0FjdGl2ZUNsYXNzfWApKSB7XHJcbiAgICAgICAgaWYodGhpcy5vcHRpb25zLmFjdGl2ZUNvbGxhcHNlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbGxhcHNlVGFiKCR0YXJnZXQpO1xyXG5cclxuICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSB6cGx1Z2luIGhhcyBzdWNjZXNzZnVsbHkgY29sbGFwc2VkIHRhYnMuXHJcbiAgICAgICAgICAgICogQGV2ZW50IFRhYnMjY29sbGFwc2VcclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjb2xsYXBzZS56Zi50YWJzJywgWyR0YXJnZXRdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciAkb2xkVGFiID0gdGhpcy4kZWxlbWVudC5cclxuICAgICAgICAgIGZpbmQoYC4ke3RoaXMub3B0aW9ucy5saW5rQ2xhc3N9LiR7dGhpcy5vcHRpb25zLmxpbmtBY3RpdmVDbGFzc31gKSxcclxuICAgICAgICAgICR0YWJMaW5rID0gJHRhcmdldC5maW5kKCdbcm9sZT1cInRhYlwiXScpLFxyXG4gICAgICAgICAgaGFzaCA9ICR0YWJMaW5rWzBdLmhhc2gsXHJcbiAgICAgICAgICAkdGFyZ2V0Q29udGVudCA9IHRoaXMuJHRhYkNvbnRlbnQuZmluZChoYXNoKTtcclxuXHJcbiAgICAvL2Nsb3NlIG9sZCB0YWJcclxuICAgIHRoaXMuX2NvbGxhcHNlVGFiKCRvbGRUYWIpO1xyXG5cclxuICAgIC8vb3BlbiBuZXcgdGFiXHJcbiAgICB0aGlzLl9vcGVuVGFiKCR0YXJnZXQpO1xyXG5cclxuICAgIC8vZWl0aGVyIHJlcGxhY2Ugb3IgdXBkYXRlIGJyb3dzZXIgaGlzdG9yeVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kZWVwTGluaykge1xyXG4gICAgICB2YXIgYW5jaG9yID0gJHRhcmdldC5maW5kKCdhJykuYXR0cignaHJlZicpO1xyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy51cGRhdGVIaXN0b3J5KSB7XHJcbiAgICAgICAgaGlzdG9yeS5wdXNoU3RhdGUoe30sICcnLCBhbmNob3IpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlKHt9LCAnJywgYW5jaG9yKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgcGx1Z2luIGhhcyBzdWNjZXNzZnVsbHkgY2hhbmdlZCB0YWJzLlxyXG4gICAgICogQGV2ZW50IFRhYnMjY2hhbmdlXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignY2hhbmdlLnpmLnRhYnMnLCBbJHRhcmdldCwgJHRhcmdldENvbnRlbnRdKTtcclxuXHJcbiAgICAvL2ZpcmUgdG8gY2hpbGRyZW4gYSBtdXRhdGlvbiBldmVudFxyXG4gICAgJHRhcmdldENvbnRlbnQuZmluZChcIltkYXRhLW11dGF0ZV1cIikudHJpZ2dlcihcIm11dGF0ZW1lLnpmLnRyaWdnZXJcIik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyB0aGUgdGFiIGAkdGFyZ2V0Q29udGVudGAgZGVmaW5lZCBieSBgJHRhcmdldGAuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBUYWIgdG8gT3Blbi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBfb3BlblRhYigkdGFyZ2V0KSB7XHJcbiAgICAgIHZhciAkdGFiTGluayA9ICR0YXJnZXQuZmluZCgnW3JvbGU9XCJ0YWJcIl0nKSxcclxuICAgICAgICAgIGhhc2ggPSAkdGFiTGlua1swXS5oYXNoLFxyXG4gICAgICAgICAgJHRhcmdldENvbnRlbnQgPSB0aGlzLiR0YWJDb250ZW50LmZpbmQoaGFzaCk7XHJcblxyXG4gICAgICAkdGFyZ2V0LmFkZENsYXNzKGAke3RoaXMub3B0aW9ucy5saW5rQWN0aXZlQ2xhc3N9YCk7XHJcblxyXG4gICAgICAkdGFiTGluay5hdHRyKHsnYXJpYS1zZWxlY3RlZCc6ICd0cnVlJ30pO1xyXG5cclxuICAgICAgJHRhcmdldENvbnRlbnRcclxuICAgICAgICAuYWRkQ2xhc3MoYCR7dGhpcy5vcHRpb25zLnBhbmVsQWN0aXZlQ2xhc3N9YClcclxuICAgICAgICAuYXR0cih7J2FyaWEtaGlkZGVuJzogJ2ZhbHNlJ30pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29sbGFwc2VzIGAkdGFyZ2V0Q29udGVudGAgZGVmaW5lZCBieSBgJHRhcmdldGAuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBUYWIgdG8gT3Blbi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBfY29sbGFwc2VUYWIoJHRhcmdldCkge1xyXG4gICAgdmFyICR0YXJnZXRfYW5jaG9yID0gJHRhcmdldFxyXG4gICAgICAucmVtb3ZlQ2xhc3MoYCR7dGhpcy5vcHRpb25zLmxpbmtBY3RpdmVDbGFzc31gKVxyXG4gICAgICAuZmluZCgnW3JvbGU9XCJ0YWJcIl0nKVxyXG4gICAgICAuYXR0cih7ICdhcmlhLXNlbGVjdGVkJzogJ2ZhbHNlJyB9KTtcclxuXHJcbiAgICAkKGAjJHskdGFyZ2V0X2FuY2hvci5hdHRyKCdhcmlhLWNvbnRyb2xzJyl9YClcclxuICAgICAgLnJlbW92ZUNsYXNzKGAke3RoaXMub3B0aW9ucy5wYW5lbEFjdGl2ZUNsYXNzfWApXHJcbiAgICAgIC5hdHRyKHsgJ2FyaWEtaGlkZGVuJzogJ3RydWUnIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUHVibGljIG1ldGhvZCBmb3Igc2VsZWN0aW5nIGEgY29udGVudCBwYW5lIHRvIGRpc3BsYXkuXHJcbiAgICogQHBhcmFtIHtqUXVlcnkgfCBTdHJpbmd9IGVsZW0gLSBqUXVlcnkgb2JqZWN0IG9yIHN0cmluZyBvZiB0aGUgaWQgb2YgdGhlIHBhbmUgdG8gZGlzcGxheS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBzZWxlY3RUYWIoZWxlbSkge1xyXG4gICAgdmFyIGlkU3RyO1xyXG5cclxuICAgIGlmICh0eXBlb2YgZWxlbSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgaWRTdHIgPSBlbGVtWzBdLmlkO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWRTdHIgPSBlbGVtO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChpZFN0ci5pbmRleE9mKCcjJykgPCAwKSB7XHJcbiAgICAgIGlkU3RyID0gYCMke2lkU3RyfWA7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyICR0YXJnZXQgPSB0aGlzLiR0YWJUaXRsZXMuZmluZChgW2hyZWY9XCIke2lkU3RyfVwiXWApLnBhcmVudChgLiR7dGhpcy5vcHRpb25zLmxpbmtDbGFzc31gKTtcclxuXHJcbiAgICB0aGlzLl9oYW5kbGVUYWJDaGFuZ2UoJHRhcmdldCk7XHJcbiAgfTtcclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBoZWlnaHQgb2YgZWFjaCBwYW5lbCB0byB0aGUgaGVpZ2h0IG9mIHRoZSB0YWxsZXN0IHBhbmVsLlxyXG4gICAqIElmIGVuYWJsZWQgaW4gb3B0aW9ucywgZ2V0cyBjYWxsZWQgb24gbWVkaWEgcXVlcnkgY2hhbmdlLlxyXG4gICAqIElmIGxvYWRpbmcgY29udGVudCB2aWEgZXh0ZXJuYWwgc291cmNlLCBjYW4gYmUgY2FsbGVkIGRpcmVjdGx5IG9yIHdpdGggX3JlZmxvdy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zZXRIZWlnaHQoKSB7XHJcbiAgICB2YXIgbWF4ID0gMDtcclxuICAgIHRoaXMuJHRhYkNvbnRlbnRcclxuICAgICAgLmZpbmQoYC4ke3RoaXMub3B0aW9ucy5wYW5lbENsYXNzfWApXHJcbiAgICAgIC5jc3MoJ2hlaWdodCcsICcnKVxyXG4gICAgICAuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgcGFuZWwgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgICBpc0FjdGl2ZSA9IHBhbmVsLmhhc0NsYXNzKGAke3RoaXMub3B0aW9ucy5wYW5lbEFjdGl2ZUNsYXNzfWApO1xyXG5cclxuICAgICAgICBpZiAoIWlzQWN0aXZlKSB7XHJcbiAgICAgICAgICBwYW5lbC5jc3Moeyd2aXNpYmlsaXR5JzogJ2hpZGRlbicsICdkaXNwbGF5JzogJ2Jsb2NrJ30pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHRlbXAgPSB0aGlzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcclxuXHJcbiAgICAgICAgaWYgKCFpc0FjdGl2ZSkge1xyXG4gICAgICAgICAgcGFuZWwuY3NzKHtcclxuICAgICAgICAgICAgJ3Zpc2liaWxpdHknOiAnJyxcclxuICAgICAgICAgICAgJ2Rpc3BsYXknOiAnJ1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBtYXggPSB0ZW1wID4gbWF4ID8gdGVtcCA6IG1heDtcclxuICAgICAgfSlcclxuICAgICAgLmNzcygnaGVpZ2h0JywgYCR7bWF4fXB4YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBhbiB0YWJzLlxyXG4gICAqIEBmaXJlcyBUYWJzI2Rlc3Ryb3llZFxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5maW5kKGAuJHt0aGlzLm9wdGlvbnMubGlua0NsYXNzfWApXHJcbiAgICAgIC5vZmYoJy56Zi50YWJzJykuaGlkZSgpLmVuZCgpXHJcbiAgICAgIC5maW5kKGAuJHt0aGlzLm9wdGlvbnMucGFuZWxDbGFzc31gKVxyXG4gICAgICAuaGlkZSgpO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMubWF0Y2hIZWlnaHQpIHtcclxuICAgICAgaWYgKHRoaXMuX3NldEhlaWdodE1xSGFuZGxlciAhPSBudWxsKSB7XHJcbiAgICAgICAgICQod2luZG93KS5vZmYoJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIHRoaXMuX3NldEhlaWdodE1xSGFuZGxlcik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5UYWJzLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgd2luZG93IHRvIHNjcm9sbCB0byBjb250ZW50IG9mIHBhbmUgc3BlY2lmaWVkIGJ5IGhhc2ggYW5jaG9yXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZGVlcExpbms6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBBZGp1c3QgdGhlIGRlZXAgbGluayBzY3JvbGwgdG8gbWFrZSBzdXJlIHRoZSB0b3Agb2YgdGhlIHRhYiBwYW5lbCBpcyB2aXNpYmxlXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZGVlcExpbmtTbXVkZ2U6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBBbmltYXRpb24gdGltZSAobXMpIGZvciB0aGUgZGVlcCBsaW5rIGFkanVzdG1lbnRcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMzAwXHJcbiAgICovXHJcbiAgZGVlcExpbmtTbXVkZ2VEZWxheTogMzAwLFxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIGJyb3dzZXIgaGlzdG9yeSB3aXRoIHRoZSBvcGVuIHRhYlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIHVwZGF0ZUhpc3Rvcnk6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHdpbmRvdyB0byBzY3JvbGwgdG8gY29udGVudCBvZiBhY3RpdmUgcGFuZSBvbiBsb2FkIGlmIHNldCB0byB0cnVlLlxyXG4gICAqIE5vdCByZWNvbW1lbmRlZCBpZiBtb3JlIHRoYW4gb25lIHRhYiBwYW5lbCBwZXIgcGFnZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhdXRvRm9jdXM6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBBbGxvd3Mga2V5Ym9hcmQgaW5wdXQgdG8gJ3dyYXAnIGFyb3VuZCB0aGUgdGFiIGxpbmtzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgd3JhcE9uS2V5czogdHJ1ZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSB0YWIgY29udGVudCBwYW5lcyB0byBtYXRjaCBoZWlnaHRzIGlmIHNldCB0byB0cnVlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIG1hdGNoSGVpZ2h0OiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIGFjdGl2ZSB0YWJzIHRvIGNvbGxhcHNlIHdoZW4gY2xpY2tlZC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhY3RpdmVDb2xsYXBzZTogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gYGxpYCdzIGluIHRhYiBsaW5rIGxpc3QuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICd0YWJzLXRpdGxlJ1xyXG4gICAqL1xyXG4gIGxpbmtDbGFzczogJ3RhYnMtdGl0bGUnLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBhY3RpdmUgYGxpYCBpbiB0YWIgbGluayBsaXN0LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnaXMtYWN0aXZlJ1xyXG4gICAqL1xyXG4gIGxpbmtBY3RpdmVDbGFzczogJ2lzLWFjdGl2ZScsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGNvbnRlbnQgY29udGFpbmVycy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3RhYnMtcGFuZWwnXHJcbiAgICovXHJcbiAgcGFuZWxDbGFzczogJ3RhYnMtcGFuZWwnLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBhY3RpdmUgY29udGVudCBjb250YWluZXIuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdpcy1hY3RpdmUnXHJcbiAgICovXHJcbiAgcGFuZWxBY3RpdmVDbGFzczogJ2lzLWFjdGl2ZSdcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFRhYnMsICdUYWJzJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogVG9nZ2xlciBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi50b2dnbGVyXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICovXHJcblxyXG5jbGFzcyBUb2dnbGVyIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIFRvZ2dsZXIuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIFRvZ2dsZXIjaW5pdFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBhZGQgdGhlIHRyaWdnZXIgdG8uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIFRvZ2dsZXIuZGVmYXVsdHMsIGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuICAgIHRoaXMuY2xhc3NOYW1lID0gJyc7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnVG9nZ2xlcicpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIFRvZ2dsZXIgcGx1Z2luIGJ5IHBhcnNpbmcgdGhlIHRvZ2dsZSBjbGFzcyBmcm9tIGRhdGEtdG9nZ2xlciwgb3IgYW5pbWF0aW9uIGNsYXNzZXMgZnJvbSBkYXRhLWFuaW1hdGUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBpbnB1dDtcclxuICAgIC8vIFBhcnNlIGFuaW1hdGlvbiBjbGFzc2VzIGlmIHRoZXkgd2VyZSBzZXRcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYW5pbWF0ZSkge1xyXG4gICAgICBpbnB1dCA9IHRoaXMub3B0aW9ucy5hbmltYXRlLnNwbGl0KCcgJyk7XHJcblxyXG4gICAgICB0aGlzLmFuaW1hdGlvbkluID0gaW5wdXRbMF07XHJcbiAgICAgIHRoaXMuYW5pbWF0aW9uT3V0ID0gaW5wdXRbMV0gfHwgbnVsbDtcclxuICAgIH1cclxuICAgIC8vIE90aGVyd2lzZSwgcGFyc2UgdG9nZ2xlIGNsYXNzXHJcbiAgICBlbHNlIHtcclxuICAgICAgaW5wdXQgPSB0aGlzLiRlbGVtZW50LmRhdGEoJ3RvZ2dsZXInKTtcclxuICAgICAgLy8gQWxsb3cgZm9yIGEgLiBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBzdHJpbmdcclxuICAgICAgdGhpcy5jbGFzc05hbWUgPSBpbnB1dFswXSA9PT0gJy4nID8gaW5wdXQuc2xpY2UoMSkgOiBpbnB1dDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBZGQgQVJJQSBhdHRyaWJ1dGVzIHRvIHRyaWdnZXJzXHJcbiAgICB2YXIgaWQgPSB0aGlzLiRlbGVtZW50WzBdLmlkO1xyXG4gICAgJChgW2RhdGEtb3Blbj1cIiR7aWR9XCJdLCBbZGF0YS1jbG9zZT1cIiR7aWR9XCJdLCBbZGF0YS10b2dnbGU9XCIke2lkfVwiXWApXHJcbiAgICAgIC5hdHRyKCdhcmlhLWNvbnRyb2xzJywgaWQpO1xyXG4gICAgLy8gSWYgdGhlIHRhcmdldCBpcyBoaWRkZW4sIGFkZCBhcmlhLWhpZGRlblxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWV4cGFuZGVkJywgdGhpcy4kZWxlbWVudC5pcygnOmhpZGRlbicpID8gZmFsc2UgOiB0cnVlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIGV2ZW50cyBmb3IgdGhlIHRvZ2dsZSB0cmlnZ2VyLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCd0b2dnbGUuemYudHJpZ2dlcicpLm9uKCd0b2dnbGUuemYudHJpZ2dlcicsIHRoaXMudG9nZ2xlLmJpbmQodGhpcykpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyB0aGUgdGFyZ2V0IGNsYXNzIG9uIHRoZSB0YXJnZXQgZWxlbWVudC4gQW4gZXZlbnQgaXMgZmlyZWQgZnJvbSB0aGUgb3JpZ2luYWwgdHJpZ2dlciBkZXBlbmRpbmcgb24gaWYgdGhlIHJlc3VsdGFudCBzdGF0ZSB3YXMgXCJvblwiIG9yIFwib2ZmXCIuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIFRvZ2dsZXIjb25cclxuICAgKiBAZmlyZXMgVG9nZ2xlciNvZmZcclxuICAgKi9cclxuICB0b2dnbGUoKSB7XHJcbiAgICB0aGlzWyB0aGlzLm9wdGlvbnMuYW5pbWF0ZSA/ICdfdG9nZ2xlQW5pbWF0ZScgOiAnX3RvZ2dsZUNsYXNzJ10oKTtcclxuICB9XHJcblxyXG4gIF90b2dnbGVDbGFzcygpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQudG9nZ2xlQ2xhc3ModGhpcy5jbGFzc05hbWUpO1xyXG5cclxuICAgIHZhciBpc09uID0gdGhpcy4kZWxlbWVudC5oYXNDbGFzcyh0aGlzLmNsYXNzTmFtZSk7XHJcbiAgICBpZiAoaXNPbikge1xyXG4gICAgICAvKipcclxuICAgICAgICogRmlyZXMgaWYgdGhlIHRhcmdldCBlbGVtZW50IGhhcyB0aGUgY2xhc3MgYWZ0ZXIgYSB0b2dnbGUuXHJcbiAgICAgICAqIEBldmVudCBUb2dnbGVyI29uXHJcbiAgICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ29uLnpmLnRvZ2dsZXInKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAvKipcclxuICAgICAgICogRmlyZXMgaWYgdGhlIHRhcmdldCBlbGVtZW50IGRvZXMgbm90IGhhdmUgdGhlIGNsYXNzIGFmdGVyIGEgdG9nZ2xlLlxyXG4gICAgICAgKiBAZXZlbnQgVG9nZ2xlciNvZmZcclxuICAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignb2ZmLnpmLnRvZ2dsZXInKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl91cGRhdGVBUklBKGlzT24pO1xyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1tdXRhdGVdJykudHJpZ2dlcignbXV0YXRlbWUuemYudHJpZ2dlcicpO1xyXG4gIH1cclxuXHJcbiAgX3RvZ2dsZUFuaW1hdGUoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGlmICh0aGlzLiRlbGVtZW50LmlzKCc6aGlkZGVuJykpIHtcclxuICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZUluKHRoaXMuJGVsZW1lbnQsIHRoaXMuYW5pbWF0aW9uSW4sIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLl91cGRhdGVBUklBKHRydWUpO1xyXG4gICAgICAgIHRoaXMudHJpZ2dlcignb24uemYudG9nZ2xlcicpO1xyXG4gICAgICAgIHRoaXMuZmluZCgnW2RhdGEtbXV0YXRlXScpLnRyaWdnZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZU91dCh0aGlzLiRlbGVtZW50LCB0aGlzLmFuaW1hdGlvbk91dCwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMuX3VwZGF0ZUFSSUEoZmFsc2UpO1xyXG4gICAgICAgIHRoaXMudHJpZ2dlcignb2ZmLnpmLnRvZ2dsZXInKTtcclxuICAgICAgICB0aGlzLmZpbmQoJ1tkYXRhLW11dGF0ZV0nKS50cmlnZ2VyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJyk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgX3VwZGF0ZUFSSUEoaXNPbikge1xyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWV4cGFuZGVkJywgaXNPbiA/IHRydWUgOiBmYWxzZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgaW5zdGFuY2Ugb2YgVG9nZ2xlciBvbiB0aGUgZWxlbWVudC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi50b2dnbGVyJyk7XHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5Ub2dnbGVyLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIFRlbGxzIHRoZSBwbHVnaW4gaWYgdGhlIGVsZW1lbnQgc2hvdWxkIGFuaW1hdGVkIHdoZW4gdG9nZ2xlZC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhbmltYXRlOiBmYWxzZVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oVG9nZ2xlciwgJ1RvZ2dsZXInKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBUb29sdGlwIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnRvb2x0aXBcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5ib3hcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICovXHJcblxyXG5jbGFzcyBUb29sdGlwIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGEgVG9vbHRpcC5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgVG9vbHRpcCNpbml0XHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGF0dGFjaCBhIHRvb2x0aXAgdG8uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBvYmplY3QgdG8gZXh0ZW5kIHRoZSBkZWZhdWx0IGNvbmZpZ3VyYXRpb24uXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgVG9vbHRpcC5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuaXNBY3RpdmUgPSBmYWxzZTtcclxuICAgIHRoaXMuaXNDbGljayA9IGZhbHNlO1xyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1Rvb2x0aXAnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSB0b29sdGlwIGJ5IHNldHRpbmcgdGhlIGNyZWF0aW5nIHRoZSB0aXAgZWxlbWVudCwgYWRkaW5nIGl0J3MgdGV4dCwgc2V0dGluZyBwcml2YXRlIHZhcmlhYmxlcyBhbmQgc2V0dGluZyBhdHRyaWJ1dGVzIG9uIHRoZSBhbmNob3IuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBlbGVtSWQgPSB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtZGVzY3JpYmVkYnknKSB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICd0b29sdGlwJyk7XHJcblxyXG4gICAgdGhpcy5vcHRpb25zLnBvc2l0aW9uQ2xhc3MgPSB0aGlzLm9wdGlvbnMucG9zaXRpb25DbGFzcyB8fCB0aGlzLl9nZXRQb3NpdGlvbkNsYXNzKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgdGhpcy5vcHRpb25zLnRpcFRleHQgPSB0aGlzLm9wdGlvbnMudGlwVGV4dCB8fCB0aGlzLiRlbGVtZW50LmF0dHIoJ3RpdGxlJyk7XHJcbiAgICB0aGlzLnRlbXBsYXRlID0gdGhpcy5vcHRpb25zLnRlbXBsYXRlID8gJCh0aGlzLm9wdGlvbnMudGVtcGxhdGUpIDogdGhpcy5fYnVpbGRUZW1wbGF0ZShlbGVtSWQpO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYWxsb3dIdG1sKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUuYXBwZW5kVG8oZG9jdW1lbnQuYm9keSlcclxuICAgICAgICAuaHRtbCh0aGlzLm9wdGlvbnMudGlwVGV4dClcclxuICAgICAgICAuaGlkZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5hcHBlbmRUbyhkb2N1bWVudC5ib2R5KVxyXG4gICAgICAgIC50ZXh0KHRoaXMub3B0aW9ucy50aXBUZXh0KVxyXG4gICAgICAgIC5oaWRlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKHtcclxuICAgICAgJ3RpdGxlJzogJycsXHJcbiAgICAgICdhcmlhLWRlc2NyaWJlZGJ5JzogZWxlbUlkLFxyXG4gICAgICAnZGF0YS15ZXRpLWJveCc6IGVsZW1JZCxcclxuICAgICAgJ2RhdGEtdG9nZ2xlJzogZWxlbUlkLFxyXG4gICAgICAnZGF0YS1yZXNpemUnOiBlbGVtSWRcclxuICAgIH0pLmFkZENsYXNzKHRoaXMub3B0aW9ucy50cmlnZ2VyQ2xhc3MpO1xyXG5cclxuICAgIC8vaGVscGVyIHZhcmlhYmxlcyB0byB0cmFjayBtb3ZlbWVudCBvbiBjb2xsaXNpb25zXHJcbiAgICB0aGlzLnVzZWRQb3NpdGlvbnMgPSBbXTtcclxuICAgIHRoaXMuY291bnRlciA9IDQ7XHJcbiAgICB0aGlzLmNsYXNzQ2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR3JhYnMgdGhlIGN1cnJlbnQgcG9zaXRpb25pbmcgY2xhc3MsIGlmIHByZXNlbnQsIGFuZCByZXR1cm5zIHRoZSB2YWx1ZSBvciBhbiBlbXB0eSBzdHJpbmcuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZ2V0UG9zaXRpb25DbGFzcyhlbGVtZW50KSB7XHJcbiAgICBpZiAoIWVsZW1lbnQpIHsgcmV0dXJuICcnOyB9XHJcbiAgICAvLyB2YXIgcG9zaXRpb24gPSBlbGVtZW50LmF0dHIoJ2NsYXNzJykubWF0Y2goL3RvcHxsZWZ0fHJpZ2h0L2cpO1xyXG4gICAgdmFyIHBvc2l0aW9uID0gZWxlbWVudFswXS5jbGFzc05hbWUubWF0Y2goL1xcYih0b3B8bGVmdHxyaWdodClcXGIvZyk7XHJcbiAgICAgICAgcG9zaXRpb24gPSBwb3NpdGlvbiA/IHBvc2l0aW9uWzBdIDogJyc7XHJcbiAgICByZXR1cm4gcG9zaXRpb247XHJcbiAgfTtcclxuICAvKipcclxuICAgKiBidWlsZHMgdGhlIHRvb2x0aXAgZWxlbWVudCwgYWRkcyBhdHRyaWJ1dGVzLCBhbmQgcmV0dXJucyB0aGUgdGVtcGxhdGUuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfYnVpbGRUZW1wbGF0ZShpZCkge1xyXG4gICAgdmFyIHRlbXBsYXRlQ2xhc3NlcyA9IChgJHt0aGlzLm9wdGlvbnMudG9vbHRpcENsYXNzfSAke3RoaXMub3B0aW9ucy5wb3NpdGlvbkNsYXNzfSAke3RoaXMub3B0aW9ucy50ZW1wbGF0ZUNsYXNzZXN9YCkudHJpbSgpO1xyXG4gICAgdmFyICR0ZW1wbGF0ZSA9ICAkKCc8ZGl2PjwvZGl2PicpLmFkZENsYXNzKHRlbXBsYXRlQ2xhc3NlcykuYXR0cih7XHJcbiAgICAgICdyb2xlJzogJ3Rvb2x0aXAnLFxyXG4gICAgICAnYXJpYS1oaWRkZW4nOiB0cnVlLFxyXG4gICAgICAnZGF0YS1pcy1hY3RpdmUnOiBmYWxzZSxcclxuICAgICAgJ2RhdGEtaXMtZm9jdXMnOiBmYWxzZSxcclxuICAgICAgJ2lkJzogaWRcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuICR0ZW1wbGF0ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgaWYgYSBjb2xsaXNpb24gZXZlbnQgaXMgZGV0ZWN0ZWQuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBvc2l0aW9uIC0gcG9zaXRpb25pbmcgY2xhc3MgdG8gdHJ5XHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcmVwb3NpdGlvbihwb3NpdGlvbikge1xyXG4gICAgdGhpcy51c2VkUG9zaXRpb25zLnB1c2gocG9zaXRpb24gPyBwb3NpdGlvbiA6ICdib3R0b20nKTtcclxuXHJcbiAgICAvL2RlZmF1bHQsIHRyeSBzd2l0Y2hpbmcgdG8gb3Bwb3NpdGUgc2lkZVxyXG4gICAgaWYgKCFwb3NpdGlvbiAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3RvcCcpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5hZGRDbGFzcygndG9wJyk7XHJcbiAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAndG9wJyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAnbGVmdCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdyaWdodCcpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmVDbGFzcyhwb3NpdGlvbilcclxuICAgICAgICAgIC5hZGRDbGFzcygncmlnaHQnKTtcclxuICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICdyaWdodCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZUNsYXNzKHBvc2l0aW9uKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdsZWZ0Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy9pZiBkZWZhdWx0IGNoYW5nZSBkaWRuJ3Qgd29yaywgdHJ5IGJvdHRvbSBvciBsZWZ0IGZpcnN0XHJcbiAgICBlbHNlIGlmICghcG9zaXRpb24gJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCd0b3AnKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUuYWRkQ2xhc3MoJ2xlZnQnKTtcclxuICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICd0b3AnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZUNsYXNzKHBvc2l0aW9uKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdsZWZ0Jyk7XHJcbiAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAnbGVmdCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdyaWdodCcpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICdyaWdodCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfVxyXG4gICAgLy9pZiBub3RoaW5nIGNsZWFyZWQsIHNldCB0byBib3R0b21cclxuICAgIGVsc2Uge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH1cclxuICAgIHRoaXMuY2xhc3NDaGFuZ2VkID0gdHJ1ZTtcclxuICAgIHRoaXMuY291bnRlci0tO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogc2V0cyB0aGUgcG9zaXRpb24gY2xhc3Mgb2YgYW4gZWxlbWVudCBhbmQgcmVjdXJzaXZlbHkgY2FsbHMgaXRzZWxmIHVudGlsIHRoZXJlIGFyZSBubyBtb3JlIHBvc3NpYmxlIHBvc2l0aW9ucyB0byBhdHRlbXB0LCBvciB0aGUgdG9vbHRpcCBlbGVtZW50IGlzIG5vIGxvbmdlciBjb2xsaWRpbmcuXHJcbiAgICogaWYgdGhlIHRvb2x0aXAgaXMgbGFyZ2VyIHRoYW4gdGhlIHNjcmVlbiB3aWR0aCwgZGVmYXVsdCB0byBmdWxsIHdpZHRoIC0gYW55IHVzZXIgc2VsZWN0ZWQgbWFyZ2luXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc2V0UG9zaXRpb24oKSB7XHJcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLl9nZXRQb3NpdGlvbkNsYXNzKHRoaXMudGVtcGxhdGUpLFxyXG4gICAgICAgICR0aXBEaW1zID0gRm91bmRhdGlvbi5Cb3guR2V0RGltZW5zaW9ucyh0aGlzLnRlbXBsYXRlKSxcclxuICAgICAgICAkYW5jaG9yRGltcyA9IEZvdW5kYXRpb24uQm94LkdldERpbWVuc2lvbnModGhpcy4kZWxlbWVudCksXHJcbiAgICAgICAgZGlyZWN0aW9uID0gKHBvc2l0aW9uID09PSAnbGVmdCcgPyAnbGVmdCcgOiAoKHBvc2l0aW9uID09PSAncmlnaHQnKSA/ICdsZWZ0JyA6ICd0b3AnKSksXHJcbiAgICAgICAgcGFyYW0gPSAoZGlyZWN0aW9uID09PSAndG9wJykgPyAnaGVpZ2h0JyA6ICd3aWR0aCcsXHJcbiAgICAgICAgb2Zmc2V0ID0gKHBhcmFtID09PSAnaGVpZ2h0JykgPyB0aGlzLm9wdGlvbnMudk9mZnNldCA6IHRoaXMub3B0aW9ucy5oT2Zmc2V0LFxyXG4gICAgICAgIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBpZiAoKCR0aXBEaW1zLndpZHRoID49ICR0aXBEaW1zLndpbmRvd0RpbXMud2lkdGgpIHx8ICghdGhpcy5jb3VudGVyICYmICFGb3VuZGF0aW9uLkJveC5JbU5vdFRvdWNoaW5nWW91KHRoaXMudGVtcGxhdGUpKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLm9mZnNldChGb3VuZGF0aW9uLkJveC5HZXRPZmZzZXRzKHRoaXMudGVtcGxhdGUsIHRoaXMuJGVsZW1lbnQsICdjZW50ZXIgYm90dG9tJywgdGhpcy5vcHRpb25zLnZPZmZzZXQsIHRoaXMub3B0aW9ucy5oT2Zmc2V0LCB0cnVlKSkuY3NzKHtcclxuICAgICAgLy8gdGhpcy4kZWxlbWVudC5vZmZzZXQoRm91bmRhdGlvbi5HZXRPZmZzZXRzKHRoaXMudGVtcGxhdGUsIHRoaXMuJGVsZW1lbnQsICdjZW50ZXIgYm90dG9tJywgdGhpcy5vcHRpb25zLnZPZmZzZXQsIHRoaXMub3B0aW9ucy5oT2Zmc2V0LCB0cnVlKSkuY3NzKHtcclxuICAgICAgICAnd2lkdGgnOiAkYW5jaG9yRGltcy53aW5kb3dEaW1zLndpZHRoIC0gKHRoaXMub3B0aW9ucy5oT2Zmc2V0ICogMiksXHJcbiAgICAgICAgJ2hlaWdodCc6ICdhdXRvJ1xyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudGVtcGxhdGUub2Zmc2V0KEZvdW5kYXRpb24uQm94LkdldE9mZnNldHModGhpcy50ZW1wbGF0ZSwgdGhpcy4kZWxlbWVudCwnY2VudGVyICcgKyAocG9zaXRpb24gfHwgJ2JvdHRvbScpLCB0aGlzLm9wdGlvbnMudk9mZnNldCwgdGhpcy5vcHRpb25zLmhPZmZzZXQpKTtcclxuXHJcbiAgICB3aGlsZSghRm91bmRhdGlvbi5Cb3guSW1Ob3RUb3VjaGluZ1lvdSh0aGlzLnRlbXBsYXRlKSAmJiB0aGlzLmNvdW50ZXIpIHtcclxuICAgICAgdGhpcy5fcmVwb3NpdGlvbihwb3NpdGlvbik7XHJcbiAgICAgIHRoaXMuX3NldFBvc2l0aW9uKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiByZXZlYWxzIHRoZSB0b29sdGlwLCBhbmQgZmlyZXMgYW4gZXZlbnQgdG8gY2xvc2UgYW55IG90aGVyIG9wZW4gdG9vbHRpcHMgb24gdGhlIHBhZ2VcclxuICAgKiBAZmlyZXMgVG9vbHRpcCNjbG9zZW1lXHJcbiAgICogQGZpcmVzIFRvb2x0aXAjc2hvd1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHNob3coKSB7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnNob3dPbiAhPT0gJ2FsbCcgJiYgIUZvdW5kYXRpb24uTWVkaWFRdWVyeS5pcyh0aGlzLm9wdGlvbnMuc2hvd09uKSkge1xyXG4gICAgICAvLyBjb25zb2xlLmVycm9yKCdUaGUgc2NyZWVuIGlzIHRvbyBzbWFsbCB0byBkaXNwbGF5IHRoaXMgdG9vbHRpcCcpO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMudGVtcGxhdGUuY3NzKCd2aXNpYmlsaXR5JywgJ2hpZGRlbicpLnNob3coKTtcclxuICAgIHRoaXMuX3NldFBvc2l0aW9uKCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB0byBjbG9zZSBhbGwgb3RoZXIgb3BlbiB0b29sdGlwcyBvbiB0aGUgcGFnZVxyXG4gICAgICogQGV2ZW50IENsb3NlbWUjdG9vbHRpcFxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2Nsb3NlbWUuemYudG9vbHRpcCcsIHRoaXMudGVtcGxhdGUuYXR0cignaWQnKSk7XHJcblxyXG5cclxuICAgIHRoaXMudGVtcGxhdGUuYXR0cih7XHJcbiAgICAgICdkYXRhLWlzLWFjdGl2ZSc6IHRydWUsXHJcbiAgICAgICdhcmlhLWhpZGRlbic6IGZhbHNlXHJcbiAgICB9KTtcclxuICAgIF90aGlzLmlzQWN0aXZlID0gdHJ1ZTtcclxuICAgIC8vIGNvbnNvbGUubG9nKHRoaXMudGVtcGxhdGUpO1xyXG4gICAgdGhpcy50ZW1wbGF0ZS5zdG9wKCkuaGlkZSgpLmNzcygndmlzaWJpbGl0eScsICcnKS5mYWRlSW4odGhpcy5vcHRpb25zLmZhZGVJbkR1cmF0aW9uLCBmdW5jdGlvbigpIHtcclxuICAgICAgLy9tYXliZSBkbyBzdHVmZj9cclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSB0b29sdGlwIGlzIHNob3duXHJcbiAgICAgKiBAZXZlbnQgVG9vbHRpcCNzaG93XHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignc2hvdy56Zi50b29sdGlwJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIaWRlcyB0aGUgY3VycmVudCB0b29sdGlwLCBhbmQgcmVzZXRzIHRoZSBwb3NpdGlvbmluZyBjbGFzcyBpZiBpdCB3YXMgY2hhbmdlZCBkdWUgdG8gY29sbGlzaW9uXHJcbiAgICogQGZpcmVzIFRvb2x0aXAjaGlkZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGhpZGUoKSB7XHJcbiAgICAvLyBjb25zb2xlLmxvZygnaGlkaW5nJywgdGhpcy4kZWxlbWVudC5kYXRhKCd5ZXRpLWJveCcpKTtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLnRlbXBsYXRlLnN0b3AoKS5hdHRyKHtcclxuICAgICAgJ2FyaWEtaGlkZGVuJzogdHJ1ZSxcclxuICAgICAgJ2RhdGEtaXMtYWN0aXZlJzogZmFsc2VcclxuICAgIH0pLmZhZGVPdXQodGhpcy5vcHRpb25zLmZhZGVPdXREdXJhdGlvbiwgZnVuY3Rpb24oKSB7XHJcbiAgICAgIF90aGlzLmlzQWN0aXZlID0gZmFsc2U7XHJcbiAgICAgIF90aGlzLmlzQ2xpY2sgPSBmYWxzZTtcclxuICAgICAgaWYgKF90aGlzLmNsYXNzQ2hhbmdlZCkge1xyXG4gICAgICAgIF90aGlzLnRlbXBsYXRlXHJcbiAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoX3RoaXMuX2dldFBvc2l0aW9uQ2xhc3MoX3RoaXMudGVtcGxhdGUpKVxyXG4gICAgICAgICAgICAgLmFkZENsYXNzKF90aGlzLm9wdGlvbnMucG9zaXRpb25DbGFzcyk7XHJcblxyXG4gICAgICAgX3RoaXMudXNlZFBvc2l0aW9ucyA9IFtdO1xyXG4gICAgICAgX3RoaXMuY291bnRlciA9IDQ7XHJcbiAgICAgICBfdGhpcy5jbGFzc0NoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICAvKipcclxuICAgICAqIGZpcmVzIHdoZW4gdGhlIHRvb2x0aXAgaXMgaGlkZGVuXHJcbiAgICAgKiBAZXZlbnQgVG9vbHRpcCNoaWRlXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignaGlkZS56Zi50b29sdGlwJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBhZGRzIGV2ZW50IGxpc3RlbmVycyBmb3IgdGhlIHRvb2x0aXAgYW5kIGl0cyBhbmNob3JcclxuICAgKiBUT0RPIGNvbWJpbmUgc29tZSBvZiB0aGUgbGlzdGVuZXJzIGxpa2UgZm9jdXMgYW5kIG1vdXNlZW50ZXIsIGV0Yy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdmFyICR0ZW1wbGF0ZSA9IHRoaXMudGVtcGxhdGU7XHJcbiAgICB2YXIgaXNGb2N1cyA9IGZhbHNlO1xyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLmRpc2FibGVIb3Zlcikge1xyXG5cclxuICAgICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAub24oJ21vdXNlZW50ZXIuemYudG9vbHRpcCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoIV90aGlzLmlzQWN0aXZlKSB7XHJcbiAgICAgICAgICBfdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgX3RoaXMuc2hvdygpO1xyXG4gICAgICAgICAgfSwgX3RoaXMub3B0aW9ucy5ob3ZlckRlbGF5KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5vbignbW91c2VsZWF2ZS56Zi50b29sdGlwJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGNsZWFyVGltZW91dChfdGhpcy50aW1lb3V0KTtcclxuICAgICAgICBpZiAoIWlzRm9jdXMgfHwgKF90aGlzLmlzQ2xpY2sgJiYgIV90aGlzLm9wdGlvbnMuY2xpY2tPcGVuKSkge1xyXG4gICAgICAgICAgX3RoaXMuaGlkZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbGlja09wZW4pIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbignbW91c2Vkb3duLnpmLnRvb2x0aXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICBpZiAoX3RoaXMuaXNDbGljaykge1xyXG4gICAgICAgICAgLy9fdGhpcy5oaWRlKCk7XHJcbiAgICAgICAgICAvLyBfdGhpcy5pc0NsaWNrID0gZmFsc2U7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIF90aGlzLmlzQ2xpY2sgPSB0cnVlO1xyXG4gICAgICAgICAgaWYgKChfdGhpcy5vcHRpb25zLmRpc2FibGVIb3ZlciB8fCAhX3RoaXMuJGVsZW1lbnQuYXR0cigndGFiaW5kZXgnKSkgJiYgIV90aGlzLmlzQWN0aXZlKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnNob3coKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbignbW91c2Vkb3duLnpmLnRvb2x0aXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICBfdGhpcy5pc0NsaWNrID0gdHJ1ZTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZGlzYWJsZUZvclRvdWNoKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLm9uKCd0YXAuemYudG9vbHRpcCB0b3VjaGVuZC56Zi50b29sdGlwJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIF90aGlzLmlzQWN0aXZlID8gX3RoaXMuaGlkZSgpIDogX3RoaXMuc2hvdygpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uKHtcclxuICAgICAgLy8gJ3RvZ2dsZS56Zi50cmlnZ2VyJzogdGhpcy50b2dnbGUuYmluZCh0aGlzKSxcclxuICAgICAgLy8gJ2Nsb3NlLnpmLnRyaWdnZXInOiB0aGlzLmhpZGUuYmluZCh0aGlzKVxyXG4gICAgICAnY2xvc2UuemYudHJpZ2dlcic6IHRoaXMuaGlkZS5iaW5kKHRoaXMpXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5vbignZm9jdXMuemYudG9vbHRpcCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpc0ZvY3VzID0gdHJ1ZTtcclxuICAgICAgICBpZiAoX3RoaXMuaXNDbGljaykge1xyXG4gICAgICAgICAgLy8gSWYgd2UncmUgbm90IHNob3dpbmcgb3BlbiBvbiBjbGlja3MsIHdlIG5lZWQgdG8gcHJldGVuZCBhIGNsaWNrLWxhdW5jaGVkIGZvY3VzIGlzbid0XHJcbiAgICAgICAgICAvLyBhIHJlYWwgZm9jdXMsIG90aGVyd2lzZSBvbiBob3ZlciBhbmQgY29tZSBiYWNrIHdlIGdldCBiYWQgYmVoYXZpb3JcclxuICAgICAgICAgIGlmKCFfdGhpcy5vcHRpb25zLmNsaWNrT3BlbikgeyBpc0ZvY3VzID0gZmFsc2U7IH1cclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgX3RoaXMuc2hvdygpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuXHJcbiAgICAgIC5vbignZm9jdXNvdXQuemYudG9vbHRpcCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpc0ZvY3VzID0gZmFsc2U7XHJcbiAgICAgICAgX3RoaXMuaXNDbGljayA9IGZhbHNlO1xyXG4gICAgICAgIF90aGlzLmhpZGUoKTtcclxuICAgICAgfSlcclxuXHJcbiAgICAgIC5vbigncmVzaXplbWUuemYudHJpZ2dlcicsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmIChfdGhpcy5pc0FjdGl2ZSkge1xyXG4gICAgICAgICAgX3RoaXMuX3NldFBvc2l0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIGFkZHMgYSB0b2dnbGUgbWV0aG9kLCBpbiBhZGRpdGlvbiB0byB0aGUgc3RhdGljIHNob3coKSAmIGhpZGUoKSBmdW5jdGlvbnNcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICB0b2dnbGUoKSB7XHJcbiAgICBpZiAodGhpcy5pc0FjdGl2ZSkge1xyXG4gICAgICB0aGlzLmhpZGUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuc2hvdygpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgdG9vbHRpcCwgcmVtb3ZlcyB0ZW1wbGF0ZSBlbGVtZW50IGZyb20gdGhlIHZpZXcuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cigndGl0bGUnLCB0aGlzLnRlbXBsYXRlLnRleHQoKSlcclxuICAgICAgICAgICAgICAgICAub2ZmKCcuemYudHJpZ2dlciAuemYudG9vbHRpcCcpXHJcbiAgICAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdoYXMtdGlwIHRvcCByaWdodCBsZWZ0JylcclxuICAgICAgICAgICAgICAgICAucmVtb3ZlQXR0cignYXJpYS1kZXNjcmliZWRieSBhcmlhLWhhc3BvcHVwIGRhdGEtZGlzYWJsZS1ob3ZlciBkYXRhLXJlc2l6ZSBkYXRhLXRvZ2dsZSBkYXRhLXRvb2x0aXAgZGF0YS15ZXRpLWJveCcpO1xyXG5cclxuICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlKCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuVG9vbHRpcC5kZWZhdWx0cyA9IHtcclxuICBkaXNhYmxlRm9yVG91Y2g6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIFRpbWUsIGluIG1zLCBiZWZvcmUgYSB0b29sdGlwIHNob3VsZCBvcGVuIG9uIGhvdmVyLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAyMDBcclxuICAgKi9cclxuICBob3ZlckRlbGF5OiAyMDAsXHJcbiAgLyoqXHJcbiAgICogVGltZSwgaW4gbXMsIGEgdG9vbHRpcCBzaG91bGQgdGFrZSB0byBmYWRlIGludG8gdmlldy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTUwXHJcbiAgICovXHJcbiAgZmFkZUluRHVyYXRpb246IDE1MCxcclxuICAvKipcclxuICAgKiBUaW1lLCBpbiBtcywgYSB0b29sdGlwIHNob3VsZCB0YWtlIHRvIGZhZGUgb3V0IG9mIHZpZXcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDE1MFxyXG4gICAqL1xyXG4gIGZhZGVPdXREdXJhdGlvbjogMTUwLFxyXG4gIC8qKlxyXG4gICAqIERpc2FibGVzIGhvdmVyIGV2ZW50cyBmcm9tIG9wZW5pbmcgdGhlIHRvb2x0aXAgaWYgc2V0IHRvIHRydWVcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBkaXNhYmxlSG92ZXI6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIE9wdGlvbmFsIGFkZHRpb25hbCBjbGFzc2VzIHRvIGFwcGx5IHRvIHRoZSB0b29sdGlwIHRlbXBsYXRlIG9uIGluaXQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdteS1jb29sLXRpcC1jbGFzcydcclxuICAgKi9cclxuICB0ZW1wbGF0ZUNsYXNzZXM6ICcnLFxyXG4gIC8qKlxyXG4gICAqIE5vbi1vcHRpb25hbCBjbGFzcyBhZGRlZCB0byB0b29sdGlwIHRlbXBsYXRlcy4gRm91bmRhdGlvbiBkZWZhdWx0IGlzICd0b29sdGlwJy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3Rvb2x0aXAnXHJcbiAgICovXHJcbiAgdG9vbHRpcENsYXNzOiAndG9vbHRpcCcsXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byB0aGUgdG9vbHRpcCBhbmNob3IgZWxlbWVudC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2hhcy10aXAnXHJcbiAgICovXHJcbiAgdHJpZ2dlckNsYXNzOiAnaGFzLXRpcCcsXHJcbiAgLyoqXHJcbiAgICogTWluaW11bSBicmVha3BvaW50IHNpemUgYXQgd2hpY2ggdG8gb3BlbiB0aGUgdG9vbHRpcC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3NtYWxsJ1xyXG4gICAqL1xyXG4gIHNob3dPbjogJ3NtYWxsJyxcclxuICAvKipcclxuICAgKiBDdXN0b20gdGVtcGxhdGUgdG8gYmUgdXNlZCB0byBnZW5lcmF0ZSBtYXJrdXAgZm9yIHRvb2x0aXAuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICcmbHQ7ZGl2IGNsYXNzPVwidG9vbHRpcFwiJmd0OyZsdDsvZGl2Jmd0OydcclxuICAgKi9cclxuICB0ZW1wbGF0ZTogJycsXHJcbiAgLyoqXHJcbiAgICogVGV4dCBkaXNwbGF5ZWQgaW4gdGhlIHRvb2x0aXAgdGVtcGxhdGUgb24gb3Blbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ1NvbWUgY29vbCBzcGFjZSBmYWN0IGhlcmUuJ1xyXG4gICAqL1xyXG4gIHRpcFRleHQ6ICcnLFxyXG4gIHRvdWNoQ2xvc2VUZXh0OiAnVGFwIHRvIGNsb3NlLicsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSB0b29sdGlwIHRvIHJlbWFpbiBvcGVuIGlmIHRyaWdnZXJlZCB3aXRoIGEgY2xpY2sgb3IgdG91Y2ggZXZlbnQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbGlja09wZW46IHRydWUsXHJcbiAgLyoqXHJcbiAgICogQWRkaXRpb25hbCBwb3NpdGlvbmluZyBjbGFzc2VzLCBzZXQgYnkgdGhlIEpTXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICd0b3AnXHJcbiAgICovXHJcbiAgcG9zaXRpb25DbGFzczogJycsXHJcbiAgLyoqXHJcbiAgICogRGlzdGFuY2UsIGluIHBpeGVscywgdGhlIHRlbXBsYXRlIHNob3VsZCBwdXNoIGF3YXkgZnJvbSB0aGUgYW5jaG9yIG9uIHRoZSBZIGF4aXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEwXHJcbiAgICovXHJcbiAgdk9mZnNldDogMTAsXHJcbiAgLyoqXHJcbiAgICogRGlzdGFuY2UsIGluIHBpeGVscywgdGhlIHRlbXBsYXRlIHNob3VsZCBwdXNoIGF3YXkgZnJvbSB0aGUgYW5jaG9yIG9uIHRoZSBYIGF4aXMsIGlmIGFsaWduZWQgdG8gYSBzaWRlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMlxyXG4gICAqL1xyXG4gIGhPZmZzZXQ6IDEyLFxyXG4gICAgLyoqXHJcbiAgICogQWxsb3cgSFRNTCBpbiB0b29sdGlwLiBXYXJuaW5nOiBJZiB5b3UgYXJlIGxvYWRpbmcgdXNlci1nZW5lcmF0ZWQgY29udGVudCBpbnRvIHRvb2x0aXBzLFxyXG4gICAqIGFsbG93aW5nIEhUTUwgbWF5IG9wZW4geW91cnNlbGYgdXAgdG8gWFNTIGF0dGFja3MuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYWxsb3dIdG1sOiBmYWxzZVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFRPRE8gdXRpbGl6ZSByZXNpemUgZXZlbnQgdHJpZ2dlclxyXG4gKi9cclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFRvb2x0aXAsICdUb29sdGlwJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbi8vIFBvbHlmaWxsIGZvciByZXF1ZXN0QW5pbWF0aW9uRnJhbWVcclxuKGZ1bmN0aW9uKCkge1xyXG4gIGlmICghRGF0ZS5ub3cpXHJcbiAgICBEYXRlLm5vdyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7IH07XHJcblxyXG4gIHZhciB2ZW5kb3JzID0gWyd3ZWJraXQnLCAnbW96J107XHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB2ZW5kb3JzLmxlbmd0aCAmJiAhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZTsgKytpKSB7XHJcbiAgICAgIHZhciB2cCA9IHZlbmRvcnNbaV07XHJcbiAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdnArJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xyXG4gICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSAod2luZG93W3ZwKydDYW5jZWxBbmltYXRpb25GcmFtZSddXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHx8IHdpbmRvd1t2cCsnQ2FuY2VsUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ10pO1xyXG4gIH1cclxuICBpZiAoL2lQKGFkfGhvbmV8b2QpLipPUyA2Ly50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KVxyXG4gICAgfHwgIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgIXdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSkge1xyXG4gICAgdmFyIGxhc3RUaW1lID0gMDtcclxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgIHZhciBuZXh0VGltZSA9IE1hdGgubWF4KGxhc3RUaW1lICsgMTYsIG5vdyk7XHJcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGNhbGxiYWNrKGxhc3RUaW1lID0gbmV4dFRpbWUpOyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRUaW1lIC0gbm93KTtcclxuICAgIH07XHJcbiAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjbGVhclRpbWVvdXQ7XHJcbiAgfVxyXG59KSgpO1xyXG5cclxudmFyIGluaXRDbGFzc2VzICAgPSBbJ211aS1lbnRlcicsICdtdWktbGVhdmUnXTtcclxudmFyIGFjdGl2ZUNsYXNzZXMgPSBbJ211aS1lbnRlci1hY3RpdmUnLCAnbXVpLWxlYXZlLWFjdGl2ZSddO1xyXG5cclxuLy8gRmluZCB0aGUgcmlnaHQgXCJ0cmFuc2l0aW9uZW5kXCIgZXZlbnQgZm9yIHRoaXMgYnJvd3NlclxyXG52YXIgZW5kRXZlbnQgPSAoZnVuY3Rpb24oKSB7XHJcbiAgdmFyIHRyYW5zaXRpb25zID0ge1xyXG4gICAgJ3RyYW5zaXRpb24nOiAndHJhbnNpdGlvbmVuZCcsXHJcbiAgICAnV2Via2l0VHJhbnNpdGlvbic6ICd3ZWJraXRUcmFuc2l0aW9uRW5kJyxcclxuICAgICdNb3pUcmFuc2l0aW9uJzogJ3RyYW5zaXRpb25lbmQnLFxyXG4gICAgJ09UcmFuc2l0aW9uJzogJ290cmFuc2l0aW9uZW5kJ1xyXG4gIH1cclxuICB2YXIgZWxlbSA9IHdpbmRvdy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHJcbiAgZm9yICh2YXIgdCBpbiB0cmFuc2l0aW9ucykge1xyXG4gICAgaWYgKHR5cGVvZiBlbGVtLnN0eWxlW3RdICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXR1cm4gdHJhbnNpdGlvbnNbdF07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gbnVsbDtcclxufSkoKTtcclxuXHJcbmZ1bmN0aW9uIGFuaW1hdGUoaXNJbiwgZWxlbWVudCwgYW5pbWF0aW9uLCBjYikge1xyXG4gIGVsZW1lbnQgPSAkKGVsZW1lbnQpLmVxKDApO1xyXG5cclxuICBpZiAoIWVsZW1lbnQubGVuZ3RoKSByZXR1cm47XHJcblxyXG4gIGlmIChlbmRFdmVudCA9PT0gbnVsbCkge1xyXG4gICAgaXNJbiA/IGVsZW1lbnQuc2hvdygpIDogZWxlbWVudC5oaWRlKCk7XHJcbiAgICBjYigpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgdmFyIGluaXRDbGFzcyA9IGlzSW4gPyBpbml0Q2xhc3Nlc1swXSA6IGluaXRDbGFzc2VzWzFdO1xyXG4gIHZhciBhY3RpdmVDbGFzcyA9IGlzSW4gPyBhY3RpdmVDbGFzc2VzWzBdIDogYWN0aXZlQ2xhc3Nlc1sxXTtcclxuXHJcbiAgLy8gU2V0IHVwIHRoZSBhbmltYXRpb25cclxuICByZXNldCgpO1xyXG4gIGVsZW1lbnQuYWRkQ2xhc3MoYW5pbWF0aW9uKTtcclxuICBlbGVtZW50LmNzcygndHJhbnNpdGlvbicsICdub25lJyk7XHJcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uKCkge1xyXG4gICAgZWxlbWVudC5hZGRDbGFzcyhpbml0Q2xhc3MpO1xyXG4gICAgaWYgKGlzSW4pIGVsZW1lbnQuc2hvdygpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBTdGFydCB0aGUgYW5pbWF0aW9uXHJcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uKCkge1xyXG4gICAgZWxlbWVudFswXS5vZmZzZXRXaWR0aDtcclxuICAgIGVsZW1lbnQuY3NzKCd0cmFuc2l0aW9uJywgJycpO1xyXG4gICAgZWxlbWVudC5hZGRDbGFzcyhhY3RpdmVDbGFzcyk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIENsZWFuIHVwIHRoZSBhbmltYXRpb24gd2hlbiBpdCBmaW5pc2hlc1xyXG4gIGVsZW1lbnQub25lKCd0cmFuc2l0aW9uZW5kJywgZmluaXNoKTtcclxuXHJcbiAgLy8gSGlkZXMgdGhlIGVsZW1lbnQgKGZvciBvdXQgYW5pbWF0aW9ucyksIHJlc2V0cyB0aGUgZWxlbWVudCwgYW5kIHJ1bnMgYSBjYWxsYmFja1xyXG4gIGZ1bmN0aW9uIGZpbmlzaCgpIHtcclxuICAgIGlmICghaXNJbikgZWxlbWVudC5oaWRlKCk7XHJcbiAgICByZXNldCgpO1xyXG4gICAgaWYgKGNiKSBjYi5hcHBseShlbGVtZW50KTtcclxuICB9XHJcblxyXG4gIC8vIFJlc2V0cyB0cmFuc2l0aW9ucyBhbmQgcmVtb3ZlcyBtb3Rpb24tc3BlY2lmaWMgY2xhc3Nlc1xyXG4gIGZ1bmN0aW9uIHJlc2V0KCkge1xyXG4gICAgZWxlbWVudFswXS5zdHlsZS50cmFuc2l0aW9uRHVyYXRpb24gPSAwO1xyXG4gICAgZWxlbWVudC5yZW1vdmVDbGFzcyhpbml0Q2xhc3MgKyAnICcgKyBhY3RpdmVDbGFzcyArICcgJyArIGFuaW1hdGlvbik7XHJcbiAgfVxyXG59XHJcblxyXG52YXIgTW90aW9uVUkgPSB7XHJcbiAgYW5pbWF0ZUluOiBmdW5jdGlvbihlbGVtZW50LCBhbmltYXRpb24sIGNiKSB7XHJcbiAgICBhbmltYXRlKHRydWUsIGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpO1xyXG4gIH0sXHJcblxyXG4gIGFuaW1hdGVPdXQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpIHtcclxuICAgIGFuaW1hdGUoZmFsc2UsIGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpO1xyXG4gIH1cclxufVxyXG4iLCIkKGZ1bmN0aW9uKCkge1xyXG4gICAgJCh3aW5kb3cpLnNjcm9sbCggZnVuY3Rpb24oKXtcclxuXHJcblxyXG4gICAgICAgICQoJy5oaWRlbWUnKS5lYWNoKCBmdW5jdGlvbihpKXtcclxuXHJcbiAgICAgICAgICAgIHZhciBib3R0b21fb2Zfb2JqZWN0ID0gJCh0aGlzKS5wb3NpdGlvbigpLnRvcCArICQodGhpcykub3V0ZXJIZWlnaHQoKTtcclxuICAgICAgICAgICAgdmFyIGJvdHRvbV9vZl93aW5kb3cgPSAkKHdpbmRvdykuc2Nyb2xsVG9wKCkgKyAkKHdpbmRvdykuaGVpZ2h0KCk7XHJcblxyXG4gICAgICAgICAgICAvKiBBZGp1c3QgdGhlIFwiMjAwXCIgdG8gZWl0aGVyIGhhdmUgYSBkZWxheSBvciB0aGF0IHRoZSBjb250ZW50IHN0YXJ0cyBmYWRpbmcgYSBiaXQgYmVmb3JlIHlvdSByZWFjaCBpdCAgKi9cclxuICAgICAgICAgICAgYm90dG9tX29mX3dpbmRvdyA9IGJvdHRvbV9vZl93aW5kb3cgKyA1MDA7XHJcblxyXG4gICAgICAgICAgICBpZiggYm90dG9tX29mX3dpbmRvdyA+IGJvdHRvbV9vZl9vYmplY3QgKXtcclxuXHJcbiAgICAgICAgICAgICAgICAkKHRoaXMpLmFuaW1hdGUoeydvcGFjaXR5JzonMSd9LDUwMCk7XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgfSk7XHJcbn0pO1xyXG5cclxuJCh3aW5kb3cpLnNjcm9sbChmdW5jdGlvbigpIHtcclxuXHJcbiAgLyogYW5pbWF6aW9uZSB0b3AgbWVudSAqL1xyXG4gIGlmKCQodGhpcykuc2Nyb2xsVG9wKCk+NTApe1xyXG4gICAgICAkKFwiI2JhY2t0b3RvcFwiKS5jc3MoXCJvcGFjaXR5XCIsXCIgMVwiKTtcclxuICB9IGVsc2Uge1xyXG4gICAgJChcIiNiYWNrdG90b3BcIikuY3NzKFwib3BhY2l0eVwiLCBcIjBcIik7XHJcbiAgfVxyXG5cclxuICB9KTtcclxuXHJcbiAvKkF6aW9uZSBHb1RvcCovXHJcbiBmdW5jdGlvbiBnb3RvX3RvcCgpIHtcclxuICAgJCgnaHRtbCwgYm9keScpLmFuaW1hdGUoe1xyXG4gICAgIHNjcm9sbFRvcDogMFxyXG4gICB9LDE1MDApO1xyXG4gfVxyXG5cclxuIC8qIEJBQ0sgVE8gVE9QICovXHJcbiAkKFwiI2JhY2t0b3RvcCBhXCIpLmNsaWNrKCBmdW5jdGlvbigpIHtcclxuICAgZ290b190b3AoKTtcclxuIH0pO1xyXG5cclxuLypSb2xsLWhvdmVyIGltbWFnaW5pIHdpbm5lciovXG5cbiQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCkge1xuICAkKCcuc2luZ2xlLWV2ZW50JykuaG92ZXIoXHJcbiAgICBmdW5jdGlvbigpe1xuXG4gICAgICAkKHRoaXMpLmZpbmQoJy5jYXB0aW9uJykuZmFkZUluKDM1MCk7XG4gICAgfSxcbiAgICBmdW5jdGlvbigpe1xuICAgICAgJCh0aGlzKS5maW5kKCcuY2FwdGlvbicpLmZhZGVPdXQoMjAwKTtcbiAgICB9XG4gICk7XG59KTtcclxuXHJcbiQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCkge1xyXG4gICQoJy5zaW5nbGUtZXZlbnQ2JykuaG92ZXIoXHJcbiAgICBmdW5jdGlvbigpe1xyXG5cclxuICAgICAgJCh0aGlzKS5maW5kKCcuY2FwdGlvbicpLmZhZGVJbigzNTApO1xyXG4gICAgfSxcclxuICAgIGZ1bmN0aW9uKCl7XHJcbiAgICAgICQodGhpcykuZmluZCgnLmNhcHRpb24nKS5mYWRlT3V0KDIwMCk7XHJcbiAgICB9XHJcbiAgKTtcclxufSk7XHJcblxyXG5cclxuLypDbGFzc2UgbWVudSAqL1xyXG4kKHdpbmRvdykuc2Nyb2xsKGZ1bmN0aW9uKCkge1xyXG4gIGlmKCQodGhpcykuc2Nyb2xsVG9wKCk+MTAwKXtcclxuICAkKFwiLmlzLXN0dWNrXCIpLmFkZENsYXNzKFwic21hbGxlclwiKTtcclxuICAvKiQoXCIuaXMtc3R1Y2tcIikucmVtb3ZlQ2xhc3MoXCJiaWdnZXJcIik7Ki9cclxuXHJcblxyXG59IGVsc2Uge1xyXG4kKFwiLmlzLXN0dWNrXCIpLnJlbW92ZUNsYXNzKFwic21hbGxlclwiKTtcclxuLyokKFwiLnRvcC1iYXJcIikuYWRkQ2xhc3MoXCJiaWdnZXJcIik7Ki9cclxuXHJcbiB9XHJcbiAgfSk7XHJcblxyXG5cclxuLypHcmV5IGltYWdpbmUqL1xyXG4kKHdpbmRvdykuc2Nyb2xsKGZ1bmN0aW9uKCkge1xyXG4gIGlmKCQodGhpcykuc2Nyb2xsVG9wKCk+NTAwKXtcclxuICAkKFwiLm9yYml0LWltYWdlXCIpLmFkZENsYXNzKFwiZ3JleS1vblwiKTtcclxuXHJcbn0gZWxzZSB7XHJcbiQoXCJpbWcub3JiaXQtaW1hZ2VcIikucmVtb3ZlQ2xhc3MoXCJncmV5LW9uXCIpO1xyXG5cclxuIH1cclxuICB9KTtcclxuIiwiXHJcblxyXG4gZnVuY3Rpb24gaW5pdE1hcCgpIHtcclxuICAgLy92YXIgbWFya2VyO1xyXG5cclxuXHQgLy8gQ3JlYXRlIGEgbmV3IFN0eWxlZE1hcFR5cGUgb2JqZWN0LCBwYXNzaW5nIGl0IGFuIGFycmF5IG9mIHN0eWxlcyxcclxuXHQgLy8gYW5kIHRoZSBuYW1lIHRvIGJlIGRpc3BsYXllZCBvbiB0aGUgbWFwIHR5cGUgY29udHJvbC5cclxuXHQgdmFyIHN0eWxlZE1hcFR5cGUgPSBuZXcgZ29vZ2xlLm1hcHMuU3R5bGVkTWFwVHlwZShcclxuXHJcblx0XHRcdFx0IC8qXHJcbiAgICAgICAgIHtlbGVtZW50VHlwZTogJ2dlb21ldHJ5Jywgc3R5bGVyczogW3tjb2xvcjogJyMwMDAwMDAnfV19LFxyXG5cdFx0XHRcdCB7ZWxlbWVudFR5cGU6ICdsYWJlbHMudGV4dC5maWxsJywgc3R5bGVyczogW3tjb2xvcjogJyM1MjM3MzUnfV19LFxyXG5cdFx0XHRcdCB7ZWxlbWVudFR5cGU6ICdsYWJlbHMudGV4dC5zdHJva2UnLCBzdHlsZXJzOiBbe2NvbG9yOiAnI2Y1ZjFlNid9XX0sXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZVwiLFxyXG4gICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeVwiLFxyXG4gICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODA0MDQwXCJcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDA0MFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LnN0cm9rZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjMDAwMDQwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmNvdW50cnlcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiM4MDAwMDBcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwib25cIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmUuY291bnRyeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LnN0cm9rZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODAwMDAwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmNvdW50cnlcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJsYWJlbHMudGV4dFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODA4MDAwXCJcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidmlzaWJpbGl0eVwiOiBcInNpbXBsaWZpZWRcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmUubGFuZF9wYXJjZWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwib25cIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmUubGFuZF9wYXJjZWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5zdHJva2VcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJzaW1wbGlmaWVkXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmxvY2FsaXR5XCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwib2ZmXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmxvY2FsaXR5XCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidmlzaWJpbGl0eVwiOiBcIm9uXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLm5laWdoYm9yaG9vZFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJzaW1wbGlmaWVkXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImxhbmRzY2FwZS5tYW5fbWFkZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzgxODI4NVwiXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInNhdHVyYXRpb25cIjogMjBcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuZXNzXCI6IDQ1XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJsYW5kc2NhcGUubWFuX21hZGVcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5zdHJva2VcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJvblwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJsYW5kc2NhcGUubWFuX21hZGVcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJsYWJlbHMudGV4dC5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJzYXR1cmF0aW9uXCI6IDUwXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImxpZ2h0bmVzc1wiOiAtNDBcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImxhbmRzY2FwZS5uYXR1cmFsXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuc3Ryb2tlXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiM0MDgwODBcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwibGFuZHNjYXBlLm5hdHVyYWwubGFuZGNvdmVyXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwic2F0dXJhdGlvblwiOiAtMjBcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuZXNzXCI6IDEwMFxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwibGFuZHNjYXBlLm5hdHVyYWwudGVycmFpblwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJzaW1wbGlmaWVkXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInBvaS5wYXJrXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwic2F0dXJhdGlvblwiOiAzNVxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogMzVcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInBvaS5wbGFjZV9vZl93b3JzaGlwXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjMDAwMDAwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQuYXJ0ZXJpYWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiNjZmI2M2FcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJzYXR1cmF0aW9uXCI6IDEwMFxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogMjVcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwid2VpZ2h0XCI6IDIuNVxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwicm9hZC5hcnRlcmlhbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LnN0cm9rZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjY2ZiNjNhXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQuaGlnaHdheVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzNjOTRjNFwiXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImxpZ2h0bmVzc1wiOiA0NVxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwicm9hZC5oaWdod2F5LmNvbnRyb2xsZWRfYWNjZXNzXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjZmY4MDAwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQubG9jYWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiNjZmJiNTJcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogNVxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ3ZWlnaHRcIjogNFxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwidHJhbnNpdC5zdGF0aW9uLmJ1c1wiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5XCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiM4MGZmMDBcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwidHJhbnNpdC5zdGF0aW9uLmJ1c1wiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJ0cmFuc2l0LnN0YXRpb24ucmFpbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9XHJcblx0XHRcdCBdLFxyXG5cdFx0XHQge25hbWU6ICdTdHlsZWQgTWFwJ30pO1xyXG5cclxuIHZhciBtYXAgPSBuZXcgZ29vZ2xlLm1hcHMuTWFwKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYXAnKSwge1xyXG5cdCB6b29tOiAxOSxcclxuXHQgY2VudGVyOiB7bGF0OiA0NS40ODEwODg1MDAwMDAwMSwgbG5nOiA5LjIwODg4NjM5OTk5OTk4M31cclxuIH0pO1xyXG5cclxuXHQgbWFwLm1hcFR5cGVzLnNldCgnc3R5bGVkX21hcCcsIHN0eWxlZE1hcFR5cGUpO1xyXG5cdCBtYXAuc2V0TWFwVHlwZUlkKCdzdHlsZWRfbWFwJylcclxuXHJcbiAgIHZhciBpbWFnZSA9ICdodHRwOi8vd3d3LmFydGVuYS5ldS90ZXN0L3dwLWNvbnRlbnQvdGhlbWVzL0ZvdW5kYXRpb25QcmVzcy9hc3NldHMvaW1hZ2VzL21hcmtlci5wbmcnO1xyXG4gICAgIHZhciBiZWFjaE1hcmtlciA9IG5ldyBnb29nbGUubWFwcy5NYXJrZXIoe1xyXG4gICAgICAgcG9zaXRpb246IHtsYXQ6IDQ1LjQ4MTA4ODUwMDAwMDAxLCBsbmc6IDkuMjA4ODg2Mzk5OTk5OTgzfSxcclxuICAgICAgIG1hcDogbWFwLFxyXG4gICAgICAgaWNvbjogaW1hZ2VcclxuICAgICB9KTtcclxuLyogbWFya2VyID0gbmV3IGdvb2dsZS5tYXBzLk1hcmtlcih7XHJcblx0IG1hcDogbWFwLFxyXG5cdCBkcmFnZ2FibGU6IGZhbHNlLFxyXG5cdCBhbmltYXRpb246IGdvb2dsZS5tYXBzLkFuaW1hdGlvbi5EUk9QLFxyXG5cdCB0aXRsZTogJ0FyZ2VudGFyaWEnLFxyXG5cdCBwb3NpdGlvbjoge2xhdDogNDUuNDgxMDg4NTAwMDAwMDEsIGxuZzogOS4yMDg4ODYzOTk5OTk5ODN9XHJcblxyXG5cclxuIH0pO1xyXG4gbWFya2VyLmFkZExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUJvdW5jZSk7Ki9cclxufVxyXG5cclxuXHJcblxyXG5cclxuLypmdW5jdGlvbiB0b2dnbGVCb3VuY2UoKSB7XHJcbmlmIChtYXJrZXIuZ2V0QW5pbWF0aW9uKCkgIT09IG51bGwpIHtcclxubWFya2VyLnNldEFuaW1hdGlvbihudWxsKTtcclxufSBlbHNlIHtcclxubWFya2VyLnNldEFuaW1hdGlvbihnb29nbGUubWFwcy5BbmltYXRpb24uQk9VTkNFKTtcclxufVxyXG59Ki9cclxuIiwialF1ZXJ5KGRvY3VtZW50KS5mb3VuZGF0aW9uKCk7XHJcbiIsIi8vIEpveXJpZGUgZGVtb1xyXG5qUXVlcnkoJyNzdGFydC1qcicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xyXG4gIGpRdWVyeShkb2N1bWVudCkuZm91bmRhdGlvbignam95cmlkZScsJ3N0YXJ0Jyk7XHJcbn0pOyIsIndpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmdW5jdGlvbigpe1xyXG53aW5kb3cuY29va2llY29uc2VudC5pbml0aWFsaXNlKHtcclxuICBcInBhbGV0dGVcIjoge1xyXG4gICAgXCJwb3B1cFwiOiB7XHJcbiAgICAgIFwiYmFja2dyb3VuZFwiOiBcIiMwMDBcIixcclxuICAgIH0sXHJcbiAgICBcImJ1dHRvblwiOiB7XHJcbiAgICAgIFwiYmFja2dyb3VuZFwiOiBcIiNjZmI1M2JcIlxyXG4gICAgfVxyXG4gIH0sXHJcbiAgXCJjb250ZW50XCI6IHtcclxuICAgIFwibWVzc2FnZVwiOiBcIlF1ZXN0byBzaXRvIHV0aWxpenphIGNvb2tpZSwgYW5jaGUgZGkgdGVyemUgcGFydGksIHBlciBpbnZpYXJ0aSBzZXJ2aXppIGluIGxpbmVhIGNvbiBsZSB0dWUgcHJlZmVyZW56ZS4gU2UgdnVvaSBzYXBlcm5lIGRpIHBpw7kgbyBuZWdhcmUgaWwgY29uc2Vuc28gYSB0dXR0aSBvIGFkIGFsY3VuaSBjb29raWUgbGVnZ2kgbCdpbmZvcm1hdGl2YSBlc3Rlc2Egc3VpIGNvb2tpZS5cIixcclxuICAgIFwiZGlzbWlzc1wiOiBcIkFjY2V0dGFcIixcclxuICAgIFwibGlua1wiOiBcIkxlZ2dpLi4uXCIsXHJcbiAgICBcImhyZWZcIjogXCJodHRwOi8vd3d3LmFydGVuYS5ldS90ZXN0L2Nvb2tpZS1wb2xpY3kvXCJcclxuICB9XHJcbn0pfSk7XHJcbiIsImpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHZpZGVvcyA9IGpRdWVyeSgnaWZyYW1lW3NyYyo9XCJ2aW1lby5jb21cIl0sIGlmcmFtZVtzcmMqPVwieW91dHViZS5jb21cIl0nKTtcclxuXHJcbiAgICB2aWRlb3MuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGVsID0galF1ZXJ5KHRoaXMpO1xyXG4gICAgICAgIGVsLndyYXAoJzxkaXYgY2xhc3M9XCJyZXNwb25zaXZlLWVtYmVkIHdpZGVzY3JlZW5cIi8+Jyk7XHJcbiAgICB9KTtcclxufSk7XHJcbiIsIlxyXG5qUXVlcnkod2luZG93KS5iaW5kKCcgbG9hZCByZXNpemUgb3JpZW50YXRpb25DaGFuZ2UgJywgZnVuY3Rpb24gKCkge1xyXG4gICB2YXIgZm9vdGVyID0galF1ZXJ5KFwiI2Zvb3Rlci1jb250YWluZXJcIik7XHJcbiAgIHZhciBwb3MgPSBmb290ZXIucG9zaXRpb24oKTtcclxuICAgdmFyIGhlaWdodCA9IGpRdWVyeSh3aW5kb3cpLmhlaWdodCgpO1xyXG4gICBoZWlnaHQgPSBoZWlnaHQgLSBwb3MudG9wO1xyXG4gICBoZWlnaHQgPSBoZWlnaHQgLSBmb290ZXIuaGVpZ2h0KCkgLTE7XHJcblxyXG4gICBmdW5jdGlvbiBzdGlja3lGb290ZXIoKSB7XHJcbiAgICAgZm9vdGVyLmNzcyh7XHJcbiAgICAgICAgICdtYXJnaW4tdG9wJzogaGVpZ2h0ICsgJ3B4J1xyXG4gICAgIH0pO1xyXG4gICB9XHJcblxyXG4gICBpZiAoaGVpZ2h0ID4gMCkge1xyXG4gICAgIHN0aWNreUZvb3RlcigpO1xyXG4gICB9XHJcbn0pO1xyXG4iXX0=
