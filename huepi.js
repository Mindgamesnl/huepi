////////////////////////////////////////////////////////////////////////////////
//
// hue (Philips Wireless Lighting) Api interface for JavaScript
//  +-> HUEPI sounds like Joepie which makes me smile during development...
//
// Requires JQuery 1.5+ for ajax calls and Deferreds
//
////////////////////////////////////////////////////////////////////////////////

/**
 * huepi Object, Entry point for all interaction with Lights etc via the Bridge.
 *
 * @class
 */
huepi = function() {
  /** @member {string} - Overidable Username for Whitelisting, must be 10-40 digits long */
  this.Username = '1234567890';

  /** @member {array} - Array of all Bridges on the local network */
  this.LocalBridges = [];

  /** @member {string} - IP address of the Current(active) Bridge */
  this.BridgeIP = '';
  /** @member {array} - Configuration of the Current(active) Bridge*/
  this.BridgeConfig = [];
  /** @member {string} - Name of the Current(active) Bridge */
  this.BridgeName = '';
  /** @member {boolean} - Indicates whitelisted username in the Current(active) Bridge, checked on Bridge in {@link HUEPI#BridgeGetData} */
  this.BridgeUsernameWhitelisted = false;

  /** @member {array} - Array of all Lights of the Current(active) Bridge */
  this.Lights = [];
  /** @member {array} - Array of all Groups of the Current(active) Bridge */
  this.Groups = [];

  // To Do: Add Schedules, Scenes, Sensors & Rules manupulation functions
  /** @member {array} - Array of all Schedules of the Current(active) Bridge, NOTE: There are no Setter functions yet */
  this.Schedules = [];
  /** @member {array} - Array of all Scenes of the Current(active) Bridge, NOTE: There are no Setter functions yet */
  this.Scenes = [];
  /** @member {array} - Array of all Sensors of the Current(active) Bridge, NOTE: There are no Setter functions yet */
  this.Sensors = [];
  /** @member {array} - Array of all Rules of the Current(active) Bridge, NOTE: There are no Setter functions yet */
  this.Rules = [];
};

////////////////////////////////////////////////////////////////////////////////
//
// Detect Running in NodeJS; module exisists and module.exports exists
//
//
if (typeof module !== 'undefined' && module.exports)
{
  var domino = require('domino');
  var $ = require('jquery')(domino.createWindow());
  var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
  $.support.cors = true; // cross domain, Cross-origin resource sharing
  $.ajaxSettings.xhr = function() {
    return new XMLHttpRequest();
  };
  exports = module.exports = huepi;
}

////////////////////////////////////////////////////////////////////////////////
//
// Portal Functions
//
//

/**
 * Retreives the list of hue-Bridges on the local network
 */
huepi.prototype.PortalDiscoverLocalBridges = function()
{
  var That = this;
  return $.get('https://www.meethue.com/api/nupnp', function(data) {
    if (data.length > 0)
      if (data[0].internalipaddress) {
        That.LocalBridges = data;
        That.BridgeIP = That.LocalBridges[0].internalipaddress; // Default to 1st Bridge internalip
      }
  });
};

////////////////////////////////////////////////////////////////////////////////
//
//  Bridge Functions
//
//

/**
 * Update function to retreive Bridge data and store it in this object.
 * Consider this the main "Get" function.
 * Typically used for Heartbeat or manual updates of local data.
 */
huepi.prototype.BridgeGetData = function()
{ // GET /api/username -> data.config.whitelist.username
  var That = this;
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username;
  return $.get(url, function(data) {
    That.Lights = data.lights;
    That.Groups = data.groups;
    That.BridgeConfig = data.config;
    That.Schedules = data.schedules;
    That.Scenes = data.scenes;
    That.Sensors = data.sensors;
    That.Rules = data.rules;
    if (That.BridgeConfig !== undefined) {
      That.BridgeName = That.BridgeConfig.name;
      // if able to read Config, Username must be Whitelisted
      That.BridgeUsernameWhitelisted = true;
    } else {
      That.BridgeName = undefined;
      That.BridgeUsernameWhitelisted = false;
    }
  });
};

/**
 * Whitelists the Username stored in this object.
 * Note: a buttonpress on the bridge is requered max 30 sec before this to succeed.
 */
huepi.prototype.BridgeCreateUser = function()
{ // POST /api {"devicetype": "iPhone", "username": "1234567890"}
  return $.ajax({
    type: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api',
    data: '{"devicetype": "WebInterface", "username": "' + this.Username + '"}'
  });
};

/**
 * @param {string} UsernameToDelete - Username that will be revoked from the Whitelist.
 * Note: Username stored in this object need to Whitelisted to succeed.
 */
huepi.prototype.BridgeDeleteUser = function(UsernameToDelete)
{ // DELETE /api/username/config/whitelist/username {"devicetype": "iPhone", "username": "1234567890"}
  return $.ajax({
    type: 'DELETE',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/config/whitelist/' + UsernameToDelete,
    data: '{"devicetype": "WebInterface", "username": "' + this.Username + '"}'
  });
};

////////////////////////////////////////////////////////////////////////////////
//
//  Helper Functions (static)
//
//

/**
 * @param {float} Red - Range [0..1]
 * @param {float} Green - Range [0..1]
 * @param {float} Blue - Range [0..1]
 * @returns {object} [Ang, Sat, Bri] - Ranges [0..360] [0..1] [0..1]
 */
huepi.HelperRGBtoHueAngSatBri = function(Red, Green, Blue)
{
  var Ang, Sat, Bri;
  var Min = Math.min(Red, Green, Blue);
  var Max = Math.max(Red, Green, Blue);
  if (Min !== Max) {
    if (Red === Max) {
      Ang = (0 + ((Green - Blue) / (Max - Min))) * 60;
    } else if (Green === Max) {
      Ang = (2 + ((Blue - Red) / (Max - Min))) * 60;
    } else {
      Ang = (4 + ((Red - Green) / (Max - Min))) * 60;
    }
    Sat = (Max - Min) / Max;
    Bri = Max;
  } else { // Max == Min
    Ang = 0;
    Sat = 0;
    Bri = Max;
  }
  return {Ang: Ang, Sat: Sat, Bri: Bri};
};

/**
 * Convert skewed Yellow/Green Hue to Correct HueAng
 * @param {float} Hue - Range [0..65535]
 * @returns {float} - Range [0..360]
 *
 */
huepi.HelperHuetoHueAng = function(Hue)
{ // Converted along the skewed yellow green
  var Ang = 360 * Hue / 65535;
  
  if (Ang>0) {
    if (Ang<90)
      Ang = Ang - Ang * 0.17 * (Ang/90); // Longer Red, shorter Green
    else if (Ang<180)
      Ang = Ang - (180-Ang) *  0.17 * ((180-Ang)/90); // Longer Red, shorter Green
  }
  return Ang;
}

/**
 * @param {float} Ang - Range [0..360]
 * @param {float} Sat - Range [0..1]
 * @param {float} Bri - Range [0..1]
 * @returns {object} [Red, Green, Blue] - Ranges [0..1] [0..1] [0..1]
 */
huepi.HelperHueAngSatBritoRGB = function(Ang, Sat, Bri)
{ // Range 360, 1, 1, return .Red, .Green, .Blue
  var Red, Green, Blue;
  if (Sat === 0) {
    Red = Bri;
    Green = Bri;
    Blue = Bri;
  } else
  {
    var Sector = Math.floor(Ang / 60) % 6;
    var Fraction = (Ang / 60) - Sector;
    var p = Bri * (1 - Sat);
    var q = Bri * (1 - Sat * Fraction);
    var t = Bri * (1 - Sat * (1 - Fraction));
    switch (Sector) {
      case 0:
        Red = Bri;
        Green = t;
        Blue = p;
        break;
      case 1:
        Red = q;
        Green = Bri;
        Blue = p;
        break;
      case 2:
        Red = p;
        Green = Bri;
        Blue = t;
        break;
      case 3:
        Red = p;
        Green = q;
        Blue = Bri;
        break;
      case 4:
        Red = t;
        Green = p;
        Blue = Bri;
        break;
      default: // case 5:
        Red = Bri;
        Green = p;
        Blue = q;
        break;
    }
  }
  return {Red: Red, Green: Green, Blue: Blue};
};

/**
 * @param {float} Red - Range [0..1]
 * @param {float} Green - Range [0..1]
 * @param {float} Blue - Range [0..1]
 * @returns {object} [x, y] - Ranges [0..1] [0..1]
 */
huepi.HelperRGBtoXY = function(Red, Green, Blue)
{ // Source: https://github.com/PhilipsHue/PhilipsHueSDK-iOS-OSX/blob/master/ApplicationDesignNotes/RGB%20to%20xy%20Color%20conversion.md
  // Apply gamma correction
  if (Red > 0.04045)
    Red = Math.pow((Red + 0.055) / (1.055), 2.4);
  else
    Red = Red / 12.92;
  if (Green > 0.04045)
    Green = Math.pow((Green + 0.055) / (1.055), 2.4);
  else
    Green = Green / 12.92;
  if (Blue > 0.04045)
    Blue = Math.pow((Blue + 0.055) / (1.055), 2.4);
  else
    Blue = Blue / 12.92;
  // RGB to XYZ [M] for sRGB D65, http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
  var X = Red * 0.4124564 + Green * 0.3575761 + Blue * 0.1804375;
  var Y = Red * 0.2126729 + Green * 0.7151522 + Blue * 0.0721750;
  var Z = Red * 0.0193339 + Green * 0.1191920 + Blue * 0.9503041;
  // But we don't want Capital X,Y,Z you want lowercase [x,y] (called the color point) as per:
  if ((X + Y + Z) === 0)
    return {x: 0, y: 0};
  return {x: X / (X + Y + Z), y: Y / (X + Y + Z)};
};

/**
 * Tests if the Px,Py resides within the Gamut for the model.
 * Otherwise it will calculated the closesed point on the Gamut.
 * @param {float} Px - Range [0..1]
 * @param {float} Py - Range [0..1]
 * @param {string} Model - Modelname of the Light to Gamutcorrect Px, Py for
 * @returns {object} [x, y] - Ranges [0..1] [0..1]
 */
huepi.HelperGamutXYforModel = function(Px, Py, Model)
{
  if (Model.slice(0, 3) === 'LCT') { // For the hue bulb the corners of the triangle are:
    var PRed = {x: 0.674, y: 0.322};
    var PGreen = {x: 0.408, y: 0.517};
    var PBlue = {x: 0.168, y: 0.041};
  } else if ((Model.slice(0, 3) === 'LLC') || (Model.slice(0, 3) === 'LST')) { // For LivingColors Bloom, Aura and Iris the triangle corners are:
    var PRed = {x: 0.703, y: 0.296};
    var PGreen = {x: 0.214, y: 0.709};
    var PBlue = {x: 0.139, y: 0.081};
  } else { // Default all values
    var PRed = {x: 1.0, y: 0.0};
    var PGreen = {x: 0.0, y: 1.0};
    var PBlue = {x: 0.0, y: 0.0};
  }

  var VBR = {x: PRed.x - PBlue.x, y: PRed.y - PBlue.y}; // Blue to Red
  var VRG = {x: PGreen.x - PRed.x, y: PGreen.y - PRed.y}; // Red to Green
  var VGB = {x: PBlue.x - PGreen.x, y: PBlue.y - PGreen.y}; // Green to Blue

  var GBR = (PGreen.x - PBlue.x) * VBR.y - (PGreen.y - PBlue.y) * VBR.x; // Sign Green on Blue to Red
  var BRG = (PBlue.x - PRed.x) * VRG.y - (PBlue.y - PRed.y) * VRG.x; // Sign Blue on Red to Green
  var RGB = (PRed.x - PGreen.x) * VGB.y - (PRed.y - PGreen.y) * VGB.x; // Sign Red on Green to Blue

  var VBP = {x: Px - PBlue.x, y: Py - PBlue.y}; // Blue to Point
  var VRP = {x: Px - PRed.x, y: Py - PRed.y}; // Red to Point
  var VGP = {x: Px - PGreen.x, y: Py - PGreen.y}; // Green to Point

  var PBR = VBP.x * VBR.y - VBP.y * VBR.x; // Sign Point on Blue to Red
  var PRG = VRP.x * VRG.y - VRP.y * VRG.x; // Sign Point on Red to Green
  var PGB = VGP.x * VGB.y - VGP.y * VGB.x; // Sign Point on Green to Blue

  if ((GBR * PBR >= 0) && (BRG * PRG >= 0) && (RGB * PGB >= 0)) // All Signs Match so Px,Py must be in triangle
    return {x: Px, y: Py};

  //  Outside Triangle, Find Closesed point on Edge or Pick Vertice...
  else if (GBR * PBR <= 0) { // Outside Blue to Red
    var NormDot = (VBP.x * VBR.x + VBP.y * VBR.y) / (VBR.x * VBR.x + VBR.y * VBR.y);
    if ((NormDot >= 0.0) && (NormDot <= 1.0)) // Within Edge
      return {x: PBlue.x + NormDot * VBR.x, y: PBlue.y + NormDot * VBR.y};
    else if (NormDot < 0.0) // Outside Edge, Pick Vertice
      return {x: PBlue.x, y: PBlue.y}; // Start
    else
      return {x: PRed.x, y: PRed.y}; // End
  }
  else if (BRG * PRG <= 0) { // Outside Red to Green
    var NormDot = (VRP.x * VRG.x + VRP.y * VRG.y) / (VRG.x * VRG.x + VRG.y * VRG.y);
    if ((NormDot >= 0.0) && (NormDot <= 1.0)) // Within Edge
      return {x: PRed.x + NormDot * VRG.x, y: PRed.y + NormDot * VRG.y};
    else if (NormDot < 0.0) // Outside Edge, Pick Vertice
      return {x: PRed.x, y: PRed.y}; // Start
    else
      return {x: PGreen.x, y: PGreen.y}; // End
  }
  else if (RGB * PGB <= 0) { // Outside Green to Blue
    var NormDot = (VGP.x * VGB.x + VGP.y * VGB.y) / (VGB.x * VGB.x + VGB.y * VGB.y);
    if ((NormDot >= 0.0) && (NormDot <= 1.0)) // Within Edge
      return {x: PGreen.x + NormDot * VGB.x, y: PGreen.y + NormDot * VGB.y};
    else if (NormDot < 0.0) // Outside Edge, Pick Vertice
      return {x: PGreen.x, y: PGreen.y}; // Start
    else
      return {x: PBlue.x, y: PBlue.y}; // End
  }
};

/**
 * @param {float} x
 * @param {float} y
 * @param {string} Model - Modelname of the Light
 * @param {float} Brightness Optional
 * @returns {object} [Red, Green, Blue] - Ranges [0..1] [0..1] [0..1]
 */
huepi.HelperXYtoRGBforModel = function(x, y, Model, Brightness)
{ // Source: https://github.com/PhilipsHue/PhilipsHueSDK-iOS-OSX/blob/master/ApplicationDesignNotes/RGB%20to%20xy%20Color%20conversion.md
  Model = Model || "LCT001"; // default hue Bulb 2012
  Brightness = Brightness || 1.0; // Default full brightness
  var GamutCorrected = huepi.HelperGamutXYforModel(x, y, Model);
  x = GamutCorrected.x;
  y = GamutCorrected.y;
  var z = 1.0 - x - y;
  var Y = Brightness;
  var X = (Y / y) * x;
  var Z = (Y / y) * z;
  // XYZ to RGB [M]-1 for sRGB D65, http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
  var Red   =  X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314;
  var Green = -X * 0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  var Blue  =  X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252;
  // Limit RGB on [0..1]
  if (Red > Blue && Red > Green && Red > 1.0) { // Red is too big
    Green = Green / Red;
    Blue = Blue / Red;
    Red = 1.0;
  }
  if (Red < 0)
    Red = 0;
  if (Green > Blue && Green > Red && Green > 1.0) { // Green is too big
    Red = Red / Green;
    Blue = Blue / Green;
    Green = 1.0;
  }
  if (Green < 0)
    Green = 0;
  if (Blue > Red && Blue > Green && Blue > 1.0) { // Blue is too big
    Red = Red / Blue;
    Green = Green / Blue;
    Blue = 1.0;
  }
  if (Blue < 0)
    Blue = 0;
  // Apply reverse gamma correction
  if (Red <= 0.0031308) {
    Red = Red * 12.92;
  } else {
    Red = 1.055 * Math.pow(Red, (1.0 / 2.4)) - 0.055;
  }
  if (Green <= 0.0031308) {
    Green = Green * 12.92;
  } else {
    Green = 1.055 * Math.pow(Green, (1.0 / 2.4)) - 0.055;
  }
  if (Blue <= 0.0031308) {
    Blue = Blue * 12.92;
  } else {
    Blue = 1.055 * Math.pow(Blue, (1.0 / 2.4)) - 0.055;
  }
  // Limit RGB on [0..1]
  if (Red > Blue && Red > Green && Red > 1.0) { // Red is too big
    Green = Green / Red;
    Blue = Blue / Red;
    Red = 1.0;
  }
  if (Red < 0)
    Red = 0;
  if (Green > Blue && Green > Red && Green > 1.0) { // Green is too big
    Red = Red / Green;
    Blue = Blue / Green;
    Green = 1.0;
  }
  if (Green < 0)
    Green = 0;
  if (Blue > Red && Blue > Green && Blue > 1.0) { // Blue is too big
    Red = Red / Blue;
    Green = Green / Blue;
    Blue = 1.0;
  }
  if (Blue < 0)
    Blue = 0;
  return {Red: Red, Green: Green, Blue: Blue};
};

/**
 * @param {number} Temperature ranges [1000..66000]
 * @returns {object} [Red, Green, Blue] ranges [0..1] [0..1] [0..1]
 */
huepi.HelperColortemperaturetoRGB = function(Temperature)
{ // http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
  var Red, Green, Blue;

  Temperature = Temperature / 100;
  if (Temperature <= 66)
    Red = 255;
  else {
    Red = Temperature - 60;
    Red = 329.698727466 * Math.pow(Red, -0.1332047592);
    if (Red < 0)
      Red = 0;
    if (Red > 255)
      Red = 255;
  }
  if (Temperature <= 66) {
    Green = Temperature;
    Green = 99.4708025861 * Math.log(Green) - 161.1195681661;
    if (Green < 0)
      Green = 0;
    if (Green > 255)
      Green = 255;
  } else {
    Green = Temperature - 60;
    Green = 288.1221695283 * Math.pow(Green, -0.0755148492);
    if (Green < 0)
      Green = 0;
    if (Green > 255)
      Green = 255;
  }
  if (Temperature >= 66)
    Blue = 255;
  else {
    if (Temperature <= 19)
      Blue = 0;
    else {
      Blue = Temperature - 10;
      Blue = 138.5177312231 * Math.log(Blue) - 305.0447927307;
      if (Blue < 0)
        Blue = 0;
      if (Blue > 255)
        Blue = 255;
    }
  }
  return {Red: Red/255, Green: Green/255, Blue: Blue/255};
};

/**
 * @param {multiple} Items - Items to convert to StringArray
 * @returns {string} String array containing Items
 */
huepi.HelperToStringArray = function(Items) {
  if (typeof Items === 'number') {
    return '"' + Items.toString() + '"';
  } else if (Object.prototype.toString.call(Items) === '[object Array]') {
    var Result = '[';
    for (var ItemNr = 0; ItemNr < Items.length; ItemNr++) {
      Result += huepi.HelperToStringArray(Items[ItemNr]);
      if (ItemNr < Items.length - 1)
        Result += ',';
    }
    Result = Result + ']';
    return Result;
  } else if (typeof Items === 'string') {
    return '"' + Items + '"';
  }
};

////////////////////////////////////////////////////////////////////////////////
//
// huepi.Lightstate Object
//
//

/**
 * huepi.Lightstate Object.
 * Internal object to recieve all settings that are about to be send to the Bridge as a string.
 *
 * @class
 */
huepi.Lightstate = function()
{
///** */
////this.SetOn = function(On) {
//  this.on = On;
//};
  /** */
  this.On = function() {
    this.on = true;
    return this;
  };
  /** */
  this.Off = function() {
    this.on = false;
    return this;
  };
  /*
   * @param {number} Hue Range [0..65535]
   * @param {float} Saturation Range [0..255]
   * @param {float} Brightness Range [0..255]
   */
  this.SetHSB = function(Hue, Saturation, Brightness) { // Range 65535, 255, 255
    this.hue = Math.round(Hue);
    this.sat = Math.round(Saturation);
    this.bri = Math.round(Brightness);
    return this;
  };
  /**
   * @param {number} Hue Range [0..65535]
   */
  this.SetHue = function(Hue) {
    this.hue = Math.round(Hue);
    return this;
  };
  /**
   * @param {float} Saturation Range [0..255]
   */
  this.SetSaturation = function(Saturation) {
    this.sat = Math.round(Saturation);
    return this;
  };
  /**
   * @param {float} Brightness Range [0..255]
   */
  this.SetBrightness = function(Brightness) {
    this.bri = Math.round(Brightness);
    return this;
  };
  /**
   * @param {float} Ang Range [0..360]
   * @param {float} Sat Range [0..1]
   * @param {float} Bri Range [0..1]
   */
  this.SetHueAngSatBri = function(Ang, Sat, Bri) {
    // In: Hue in Deg, Saturation, Brightness 0.0-1.0 Transform To Philips Hue Range...
    while (Ang < 0)
      Ang = Ang + 360;
    Ang = Ang % 360;
    return this.SetHSB(Math.round(Ang / 360 * 65535), Math.round(Sat * 255), Math.round(Bri * 255));
  };
  /**
   * @param {number} Red Range [0..1]
   * @param {number} Green Range [0..1]
   * @param {number} Blue Range [0..1]
   */
  this.SetRGB = function(Red, Green, Blue) {
    var HueAngSatBri = huepi.HelperRGBtoHueAngSatBri(Red, Green, Blue);
    return this.SetHueAngSatBri(HueAngSatBri.Ang, HueAngSatBri.Sat, HueAngSatBri.Bri);
  };
  /**
   * @param {number} Ct Micro Reciprocal Degree of Colortemperature (Ct = 1000000 / Colortemperature)
   */
  this.SetCT = function(Ct) {
    this.ct = Math.round(Ct);
    return this;
  };
  /**
   * @param {number} Colortemperature Range [2000..6500] for the 2012 lights
   */
  this.SetColortemperature = function(Colortemperature) {
    this.ct = Math.round((1000000 / Colortemperature)); // Kelvin to micro reciprocal degree
    return this;
  };
  /**
   * @param {float} X
   * @param {float} Y
   */
  this.SetXY = function(X, Y) {
    this.xy = [X, Y];
    return this;
  };
///** */
//this.SetAlert = function(Alert) {
//  this.alert = Alert;
//};
  /** */
  this.AlertSelect = function() {
    this.alert = 'select';
    return this;
  };
  /** */
  this.AlertLSelect = function() {
    this.alert = 'lselect';
    return this;
  };
  /** */
  this.AlertNone = function() {
    this.alert = 'none';
    return this;
  };
///** */
//this.SetEffect = function(Effect) {
//  this.effect = Effect;
//};
  /** */
  this.EffectColorloop = function() {
    this.effect = 'colorloop';
    return this;
  };
  /** */
  this.EffectNone = function() {
    this.effect = 'none';
    return this;
  };
  /**
   * @param {number} Transitiontime Optional Transitiontime in multiple of 100ms, defaults to 4 (on bridge, meaning 400 ms)
   */
  this.SetTransitiontime = function(Transitiontime) {
    if (typeof Transitiontime !== 'undefined') // Optional Parameter
      this.transitiontime = Transitiontime;
    return this;
  };
  /**
   * @returns {string} Stringified version of the content of LightState ready to be sent to the Bridge.
   */
  this.Get = function() {
    return JSON.stringify(this);
  };

};

////////////////////////////////////////////////////////////////////////////////
//
// Light Functions
//
//

/**
 */
huepi.prototype.LightsGetData = function()
{ // GET /api/username/lights
  var That = this;
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username + '/lights';
  return $.get(url, function(data) {
    if (data) {
      That.Lights = data;
    }
  });
};

/**
 */
huepi.prototype.LightsSearchForNew = function()
{ // POST /api/username/lights
  return $.ajax({
    type: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/lights'
  });
};

/**
 */
huepi.prototype.LightsGetNew = function()
{ // GET /api/username/lights/new
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username + '/lights/new';
  return $.get(url);
};

/**
 * @param {number} LightNr
 * @param {string} Name New name of the light Range [1..32]
 */
huepi.prototype.LightSetName = function(LightNr, Name)
{ // PUT /api/username/lights
  return $.ajax({
    type: 'PUT',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/light/' + LightNr,
    data: '{"name" : "' + Name + '"}'
  });
};

/**
 * @param {number} LightNr
 * @param {LightState} State
 */
huepi.prototype.LightSetState = function(LightNr, State)
{ // PUT /api/username/lights/[LightNr]/state
  return $.ajax({
    type: 'PUT',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/lights/' + LightNr + '/state',
    data: State.Get()
  });
};

/**
 * @param {number} LightNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightOn = function(LightNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.On();
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightOff = function(LightNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.Off();
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * Sets Gamut Corrected values for HSB
 * @param {number} LightNr
 * @param {number} Hue Range [0..65535]
 * @param {number} Saturation Range [0..255]
 * @param {number} Brightness Range [0..255]
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetHSB = function(LightNr, Hue, Saturation, Brightness, Transitiontime)
{
  var HueAng = Hue * 360 / 65535;
  var Sat = Saturation / 255;
  var Bri = Brightness / 255;

  var Color = huepi.HelperHueAngSatBritoRGB(HueAng, Sat, Bri);
  var Point = huepi.HelperRGBtoXY(Color.Red, Color.Green, Color.Blue);
  return $.when(
  this.LightSetBrightness(LightNr, Brightness, Transitiontime),
  this.LightSetXY(LightNr, Point.x, Point.y, Transitiontime)
  );
};

/**
 * @param {number} LightNr
 * @param {number} Hue Range [0..65535]
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetHue = function(LightNr, Hue, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.SetHue(Hue);
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param Saturation Range [0..255]
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetSaturation = function(LightNr, Saturation, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.SetSaturation(Saturation);
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param Brightness Range [0..255]
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetBrightness = function(LightNr, Brightness, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.SetBrightness(Brightness);
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param Ang Range [0..360]
 * @param Sat Range [0..1]
 * @param Bri Range [0..1]
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetHueAngSatBri = function(LightNr, Ang, Sat, Bri, Transitiontime)
{ // In: Hue in Deg, Saturation, Brightness 0.0-1.0 Transform To Philips Hue Range...
  while (Ang < 0)
    Ang = Ang + 360;
  Ang = Ang % 360;
  return this.LightSetHSB(LightNr, Ang / 360 * 65535, Sat * 255, Bri * 255, Transitiontime);
};

/**
 * @param {number} LightNr
 * @param Red Range [0..1]
 * @param Green Range [0..1]
 * @param Blue Range [0..1]
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetRGB = function(LightNr, Red, Green, Blue, Transitiontime)
{
  var Point = huepi.HelperRGBtoXY(Red, Green, Blue);
  var HueAngSatBri = huepi.HelperRGBtoHueAngSatBri(Red, Green, Blue);
  return $.when(
  this.LightSetBrightness(HueAngSatBri.Bri * 255),
  this.LightSetXY(LightNr, Point.x, Point.y, Transitiontime)
  );
};

/**
 * @param {number} LightNr
 * @param {number} CT micro reciprocal degree
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetCT = function(LightNr, CT, Transitiontime)
{
  var Model = this.Lights[LightNr].modelid;
  if (Model !== 'LCT001') { // CT->RGB->XY to ignore Brightness in RGB
    var Color = huepi.HelperColortemperaturetoRGB(1000000 / CT);
    var Point = huepi.HelperRGBtoXY(Color.Red, Color.Green, Color.Blue);
    return this.LightSetXY(LightNr, Point.x, Point.y, Transitiontime);
  }
  var State = new huepi.Lightstate();
  State.SetCT(CT);
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param {number} Colortemperature Range [2000..65000] for the 2012 model
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetColortemperature = function(LightNr, Colortemperature, Transitiontime)
{
  return this.LightSetCT(LightNr, 1000000 / Colortemperature, Transitiontime);
};

/**
 * @param {number} LightNr
 * @param {float} X
 * @param {float} Y
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightSetXY = function(LightNr, X, Y, Transitiontime)
{
  var Model = this.Lights[LightNr].modelid;
  var Gamuted = huepi.HelperGamutXYforModel(X, Y, Model);
  var State = new huepi.Lightstate();
  State.SetXY(Gamuted.x, Gamuted.y);
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightAlertSelect = function(LightNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.AlertSelect();
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightAlertLSelect = function(LightNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.AlertLSelect();
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightAlertNone = function(LightNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.AlertNone();
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightEffectColorloop = function(LightNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.EffectColorloop();
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

/**
 * @param {number} LightNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.LightEffectNone = function(LightNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.EffectNone();
  State.SetTransitiontime(Transitiontime);
  return this.LightSetState(LightNr, State);
};

////////////////////////////////////////////////////////////////////////////////
//
// Group Functions
//
//

/**
 */
huepi.prototype.GroupsGetData = function()
{ // GET /api/username/lights
  var That = this;
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username + '/groups';
  return $.get(url, function(data) {
    if (data) {
      That.Groups = data;
    }
  });
};

/**
 * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
 * @param {string} Name New name of the light Range [1..32]
 * @param {multiple} Lights LightNr or Array of Lights to Group
 */
huepi.prototype.GroupCreate = function(Name, Lights)
{ // POST /api/username/groups
  return $.ajax({
    type: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/groups/',
    data: '{"name":"' + Name + '" , "lights":' + huepi.HelperToStringArray(Lights) + '}'
  });
};

/**
 * @param {number} GroupNr
 * @param {string} Name New name of the light Range [1..32]
 */
huepi.prototype.GroupSetName = function(GroupNr, Name)
{ // PUT /api/username/groups/[GroupNr]
  return $.ajax({
    type: 'PUT',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + GroupNr,
    data: '{"name":"' + Name + '"}'
  });
};

/**
 * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
 * @param {number} GroupNr
 * @param {multiple} Lights LightNr or Array of Lights to Group
 */
huepi.prototype.GroupSetLights = function(GroupNr, Lights)
{ // PUT /api/username/groups/[GroupNr]
  return $.ajax({
    type: 'PUT',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + GroupNr,
    data: '{"lights":' + huepi.HelperToStringArray(Lights) + '}'
  });
};

/**
 * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
 * @param {number} GroupNr
 * @param {string} Name New name of the light Range [1..32]
 * @param {multiple} Lights LightNr or Array of Lights to Group
 */
huepi.prototype.GroupSetAttributes = function(GroupNr, Name, Lights)
{ // PUT /api/username/groups/[GroupNr]
  return $.ajax({
    type: 'PUT',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + GroupNr,
    data: '{"name":"' + Name + '", "lights":' + huepi.HelperToStringArray(Lights) + '}'
  });
};

/**
 * @param {number} GroupNr
 */
huepi.prototype.GroupDelete = function(GroupNr)
{ // DELETE /api/username/groups/[GroupNr]
  return $.ajax({
    type: 'DELETE',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + GroupNr
  });
};

/**
 * @param {number} GroupNr
 * @param {LightState} State
 */
huepi.prototype.GroupSetState = function(GroupNr, State)
{ // PUT /api/username/groups/[GroupNr]/action
  return $.ajax({
    type: 'PUT',
    dataType: 'json',
    contentType: 'application/json',
    url: 'http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + GroupNr + '/action',
    data: State.Get()
  });
};

/**
 * @param {number} GroupNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupOn = function(GroupNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.On();
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupOff = function(GroupNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.Off();
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * Sets Gamut Corrected values for HSB
 * @param {number} GroupNr
 * @param {number} Hue Range [0..65535]
 * @param {number} Saturation Range [0..255]
 * @param {number} Brightness Range [0..255]
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetHSB = function(GroupNr, Hue, Saturation, Brightness, Transitiontime)
{
  var Ang = Hue * 360 / 65535;
  var Sat = Saturation / 255;
  var Bri = Brightness / 255;

  var Color = huepi.HelperHueAngSatBritoRGB(Ang, Sat, Bri);
  var Point = huepi.HelperRGBtoXY(Color.Red, Color.Green, Color.Blue);

  return $.when(// return Deferred when of both Brightness and XY
  this.GroupSetBrightness(GroupNr, Brightness, Transitiontime),
  this.GroupSetXY(GroupNr, Point.x, Point.y, Transitiontime)
  );
};

/**
 * @param {number} GroupNr
 * @param {number} Hue Range [0..65535]
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetHue = function(GroupNr, Hue, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.SetHue(Hue);
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param Saturation Range [0..255]
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetSaturation = function(GroupNr, Saturation, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.SetSaturation(Saturation);
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param Brightness Range [0..255]
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetBrightness = function(GroupNr, Brightness, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.SetBrightness(Brightness);
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param Ang Range [0..360]
 * @param Sat Range [0..1]
 * @param Bri Range [0..1]
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetHueAngSatBri = function(GroupNr, Ang, Sat, Bri, Transitiontime)
{
  while (Ang < 0)
    Ang = Ang + 360;
  Ang = Ang % 360;
  return this.GroupSetHSB(GroupNr, Ang / 360 * 65535, Sat * 255, Bri * 255, Transitiontime);
};

/**
 * @param {number} GroupNr
 * @param Red Range [0..1]
 * @param Green Range [0..1]
 * @param Blue Range [0..1]
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetRGB = function(GroupNr, Red, Green, Blue, Transitiontime)
{
  var HueAngSatBri = huepi.HelperRGBtoHueAngSatBri(Red, Green, Blue);
  return this.GroupSetHueAngSatBri(GroupNr, HueAngSatBri.Ang, HueAngSatBri.Sat, HueAngSatBri.Bri, Transitiontime);
};

/**
 * @param {number} GroupNr
 * @param {number} CT micro reciprocal degree
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetCT = function(GroupNr, CT, Transitiontime)
{
  var Lights = [];
  var LightNr = 0;

  if (GroupNr === 0) { // All Lights
    while (this.Lights[LightNr + 1]) // Build Group
      Lights[LightNr] = ++LightNr;
  } else
    var Lights = this.Groups[GroupNr].lights;

  if (Lights.length !== 0) {
    var deferreds = [];
    for (var LightNr = 0; LightNr < Lights.length; LightNr++) // For Each Light
      deferreds.push(this.LightSetCT(Lights[LightNr], CT, Transitiontime));
    return $.when.apply($, deferreds); // return Deferred when with array of deferreds
  }
  // No Lights in Group GroupNr, Set State of Group to let Bridge create the API Error and return it.
  var State = new huepi.Lightstate();
  State.SetCT(CT);
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param {number} Colortemperature Range [2000..65000] for the 2012 model
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetColortemperature = function(GroupNr, Colortemperature, Transitiontime)
{
  return this.GroupSetCT(GroupNr, 1000000 / Colortemperature, Transitiontime);
};

/**
 * @param {number} GroupNr
 * @param {float} X
 * @param {float} Y
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupSetXY = function(GroupNr, X, Y, Transitiontime)
{
  var Lights = [];
  var LightNr = 0;

  if (GroupNr === 0) { // All Lights
    while (this.Lights[LightNr + 1]) // Build Group
      Lights[LightNr] = ++LightNr;
  } else
    var Lights = this.Groups[GroupNr].lights;

  if (Lights.length !== 0) {
    var deferreds = [];
    for (var LightNr = 0; LightNr < Lights.length; LightNr++) // For Each Light
      deferreds.push(this.LightSetXY(Lights[LightNr], X, Y, Transitiontime));
    return $.when.apply($, deferreds); // return Deferred when with array of deferreds
  }
  // No Lights in Group GroupNr, Set State of Group to let Bridge create the API Error and return it.
  var State = new huepi.Lightstate();
  State.SetXY(X, Y);
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupAlertSelect = function(GroupNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.AlertSelect();
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupAlertLSelect = function(GroupNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.AlertLSelect();
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupAlertNone = function(GroupNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.AlertNone();
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupEffectColorloop = function(GroupNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.EffectColorloop();
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

/**
 * @param {number} GroupNr
 * @param {number} Transitiontime optional
 */
huepi.prototype.GroupEffectNone = function(GroupNr, Transitiontime)
{
  var State = new huepi.Lightstate();
  State.EffectNone();
  State.SetTransitiontime(Transitiontime);
  return this.GroupSetState(GroupNr, State);
};

////////////////////////////////////////////////////////////////////////////////
//
// Schedule Functions
//
//

/**
 */
huepi.prototype.SchedulesGetData = function()
{ // GET /api/username/schedules
  var That = this;
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username + '/schedules';
  return $.get(url, function(data) {
    if (data) {
      That.Schedules = data;
    }
  });
};

////////////////////////////////////////////////////////////////////////////////
//
// Scenes Functions
//
//

/**
 */
huepi.prototype.ScenesGetData = function()
{ // GET /api/username/scenes
  var That = this;
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username + '/scenes';
  return $.get(url, function(data) {
    if (data) {
      That.Scenes = data;
    }
  });
};

////////////////////////////////////////////////////////////////////////////////
//
// Sensors Functions
//
//

/**
 */
huepi.prototype.SensorsGetData = function()
{ // GET /api/username/sensors
  var That = this;
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username + '/sensors';
  return $.get(url, function(data) {
    if (data) {
      That.Sensors = data;
    }
  });
};

////////////////////////////////////////////////////////////////////////////////
//
// Rules Functions
//
//

/**
 */
huepi.prototype.RulesGetData = function()
{ // GET /api/username/rules
  var That = this;
  var url = 'http://' + this.BridgeIP + '/api/' + this.Username + '/rules';
  return $.get(url, function(data) {
    if (data) {
      That.Rules = data;
    }
  });
};


////////////////////////////////////////////////////////////////////////////////
//
// Change log
//
// 0.1
// Initial Public Release
//
// 0.2
// Renamed class Light.State -> Lightstate
// Renamed function Bridge.GetConfig -> Bridge.Get
// Renamed functions Config.* -> Bridge.*
// Added Gamut Color Correction in Lightstate.SetHSB RGB+HSB Settings Will be Color Corrected to HUE Lamp -> xy
//
// 0.21
// Rewrote Gamut Color Correction in Lightstate.SetHSB
//
// 0.3
// HUEPI is now an Object
// Renamed deeper namespaces to top namespace so HUEPI becomes one Object
//   e.g. Group.SetOn() -> GroupSetOn()
//
// 0.4
// Added Helper functions (refactured from 0.3)
// HueAngSatBri HSB RGB for lights and groups are set via SetXY and SetBrightness
// GroupSetXY splits group into Light and calls LightSetXY per Light
// LightSetXY looks up lamp Model and applies Gamut Correction for Model
// Note: Using Lightstate objects are not Gamut Corrected
//
// 0.5
// Implemented Promisses by returning JQuery Promisses (Deffereds)
// Declared local variables where applicable, cleaning up global namespace polution
// Added LightsSearchForNew and LightsGetNew and LightSetName
// Added GroupCreate GroupSetName GroupSetLights GroupSetAttributes GroupDelete
//   These need more testing ;-)
//
// 0.6
// Changed HUEPI object notation from literal to protoype notation
//  to make a bigger difference between static helper methods and object interface
// Group- and Light-SetColortemperature are set via SetCT now
// Added huepi.HelperCTtoRGB to Allow ColorLights to be set with CT as RGB
// GroupSetCT splits group into Light and calls LightSetCT per Light
// LightSetCT looks up lamp Model and sets either CT or RGB based on Model
// Note: Using Lightstate objects are not CT to RGB converted
// PortalBridges[] is renamed to LocalBridges[]
//
// 0.61
// LightSetCT = CT->RGB->XY to ignore Brightness in RGB
// changed " string to ' string
//
// 0.62
// renamed
// BridgeGet to BridgeGetData
// GroupGet to GroupsGetData
// LightGet to LightsGetData
// UsernameWhitelisted to BridgeUsernameWhitelisted
//
// 0.9
// Added detection of NodeJS
// Added WORKING JQuery NodeJS if running on NodeJS
// Added Module Exports for NodeJS on NodeJS
//
// 0.95
// renamed HUEPI to huepi to be more complient with modules and actual hue product name
//
// 0.9.6
// Renamed HelperCTtoRGB to HelperColortemperaturetoRG
// All Red, Green & Blue arguments ranges to [0..1]
//
// 0.0
// Using Matrices from RGB to XYZ [M] for sRGB D65 from http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
//


