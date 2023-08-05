// Sample Payload: cbe10b68019f017fff7fff
// Sample Payload: cc1308ec02180108d67fff

// ToDo: Enable multiple base station packets on Helium Console: https://docs.helium.com/use-the-network/console/multi-packets/
// ToDo: Enable multiple base station packets on TTN
// ToDo: Enable multiple base station packets on Chirpstack

// Dragino helper functions for LHT65N (with interchangeable sensor attachments)
function str_pad(byte) {
  var hex = byte.toString(16);
  return (hex.length === 1 ? '0' : '') + hex;
}

function datalog(i, bytes) {
  var Ext = bytes[6] & 0x0f;
  var bb;
  if (Ext == '1' || Ext == '9') {
    bb = parseFloat(
      ((((bytes[0 + i] << 24) >> 16) | bytes[1 + i]) / 100).toFixed(2)
    );
  } else if (Ext == '4') {
    var ext_pin_level = bytes[0 + i] ? 'High' : 'Low';
    var ext_status = bytes[1 + i] ? 'True' : 'False';
    bb = ext_pin_level + ext_status;
  } else if (Ext == '5') {
    bb = (bytes[0 + i] << 8) | bytes[1 + i];
  } else if (Ext == '6') {
    bb = ((bytes[0 + i] << 8) | bytes[1 + i]) / 1000;
  } else if (Ext == '7') {
    bb = (bytes[0 + i] << 8) | bytes[1 + i];
  } else if (Ext == '8') {
    bb = (bytes[0 + i] << 8) | bytes[1 + i];
  }
  var cc = parseFloat(
    ((((bytes[2 + i] << 24) >> 16) | bytes[3 + i]) / 100).toFixed(2)
  );
  var dd = parseFloat(
    ((((bytes[4 + i] << 8) | bytes[5 + i]) & 0xfff) / 10).toFixed(1)
  );
  var ee = getMyDate(
    (
      (bytes[7 + i] << 24) |
      (bytes[8 + i] << 16) |
      (bytes[9 + i] << 8) |
      bytes[10 + i]
    ).toString(10)
  );
  var string = '[' + bb + ',' + cc + ',' + dd + ',' + ee + ']' + ',';

  return string;
}

function getzf(c_num) {
  if (parseInt(c_num) < 10) c_num = '0' + c_num;

  return c_num;
}

function getMyDate(str) {
  var c_Date;
  if (str > 9999999999) c_Date = new Date(parseInt(str));
  else c_Date = new Date(parseInt(str) * 1000);

  var c_Year = c_Date.getFullYear(),
    c_Month = c_Date.getMonth() + 1,
    c_Day = c_Date.getDate(),
    c_Hour = c_Date.getHours(),
    c_Min = c_Date.getMinutes(),
    c_Sen = c_Date.getSeconds();
  var c_Time =
    c_Year +
    '-' +
    getzf(c_Month) +
    '-' +
    getzf(c_Day) +
    ' ' +
    getzf(c_Hour) +
    ':' +
    getzf(c_Min) +
    ':' +
    getzf(c_Sen);

  return c_Time;
}

// Main decoder function entry
function Decoder(bytes, port) {
  var decoded = {};
  var baseStationLatitude = 0;
  var baseStationLongitude = 0;
  var baseStationsCount = 0;
  var Ext = bytes[6] & 0x0f;
  var poll_message_status = (bytes[6] & 0x40) >> 6;
  var Connect = (bytes[6] & 0x80) >> 7;

  // Test for LoRa properties in normalizedPayload
  try {
    if (
      normalizedPayload.gateways &&
      Array.isArray(normalizedPayload.gateways) &&
      normalizedPayload.gateways.length > 0
    ) {
      decoded.lora_rssi = normalizedPayload.gateways[0].rssi || 0;
      decoded.lora_snr = normalizedPayload.gateways[0].snr || 0;
      decoded.lora_datarate = normalizedPayload.data_rate || 'not retrievable';
    }
  } catch (error) {
    console.log('Error occurred while decoding LoRa properties: ' + error);
  }

  function getStrongestBaseStation(baseStations) {
    var baseStationMetadata = baseStations.map(function (baseStation) {
      return {
        rssi: baseStation.rssi,
        snr: baseStation.snr,
        lat: baseStation.lat,
        long: baseStation.long,
      };
    });

    var strongestBaseStation = baseStationMetadata[0];
    for (var i = 1; i < baseStationMetadata.length; i++) {
      if (
        baseStationMetadata[i].rssi > strongestBaseStation.rssi ||
        (baseStationMetadata[i].rssi === strongestBaseStation.rssi &&
          baseStationMetadata[i].snr > strongestBaseStation.snr)
      ) {
        strongestBaseStation = baseStationMetadata[i];
      }
    }
    return strongestBaseStation;
  }

  // Test for location data in rawPayload
  try {
    // Test for TTI
    var hotspots = rawPayload.uplink_message.rx_metadata;
    if (hotspots && Array.isArray(hotspots) && hotspots.length > 0) {
      var strongestBaseStation = getStrongestBaseStation(hotspots);
      baseStationLatitude = strongestBaseStation.lat;
      baseStationLongitude = strongestBaseStation.long;
      baseStationsCount = hotspots.length;
    }
  } catch (error) {
    try {
      // Test for Helium
      var hotspots = rawPayload.hotspots;
      if (hotspots && Array.isArray(hotspots) && hotspots.length > 0) {
        var strongestBaseStation = getStrongestBaseStation(hotspots);
        baseStationLatitude = strongestBaseStation.lat;
        baseStationLongitude = strongestBaseStation.long;
        baseStationsCount = hotspots.length;
      }
    } catch (error) {
      try {
        // Test for Chirpstack
        var hotspots = rawPayload.rxInfo;
        if (hotspots && Array.isArray(hotspots) && hotspots.length > 0) {
          var strongestBaseStation = getStrongestBaseStation(hotspots);
          baseStationLatitude = strongestBaseStation.lat;
          baseStationLongitude = strongestBaseStation.long;
          baseStationsCount = hotspots.length;
        }
      } catch (error) {
        try {
          // Test for Managed Helium
          var messages = rawPayload.messages;
          if (messages && Array.isArray(messages) && messages.length > 0) {
            var via = messages[0].via;
            if (via && Array.isArray(via) && via.length > 0) {
              var strongestBaseStation = getStrongestBaseStation(via);
              baseStationLatitude = strongestBaseStation.lat;
              baseStationLongitude = strongestBaseStation.long;
              baseStationsCount = via.length;
              decoded.lora_datarate =
                messages[0].metadata.txModulationLoraSpreadingFactor;
              decoded.lora_snr = strongestBaseStation.snr;
              decoded.lora_rssi = strongestBaseStation.rssi;
            }
          }
        } catch (error) {
          console.log(
            'Unable to decode location. No supported LNS found: ' + error
          );
          baseStationLatitude = 0;
          baseStationLongitude = 0;
          baseStationsCount = 0;
        }
      }
    }
  }

  // include location data only if it has a value not Zero
  if (
    baseStationLatitude !== 0 &&
    baseStationLongitude !== 0 &&
    baseStationsCount !== 0
  ) {
    decoded.location =
      '(' + baseStationLatitude + ',' + baseStationLongitude + ')';
    decoded.locations_count = baseStationsCount;
  }

  // Dragino sensor data decoding logic
  switch (poll_message_status) {
    case 0:
      {
        if (Ext == 0x09) {
          decoded.temperature_probe = parseFloat(
            ((((bytes[0] << 24) >> 16) | bytes[1]) / 100).toFixed(2)
          );
          decoded.bat_status = bytes[4] >> 6;
        } else {
          decoded.battery = (((bytes[0] << 8) | bytes[1]) & 0x3fff) / 1000;
          decoded.bat_status = bytes[0] >> 6;
        }

        if (Ext != 0x0f) {
          decoded.temperature = parseFloat(
            ((((bytes[2] << 24) >> 16) | bytes[3]) / 100).toFixed(2)
          );
          decoded.humidity = parseFloat(
            ((((bytes[4] << 8) | bytes[5]) & 0xfff) / 10).toFixed(1)
          );
        }
        if (Connect == '1') {
          decoded.no_connect = 'Sensor no connection';
        }

        if (Ext == '0') {
          decoded.ext_sensor = 'No external sensor';
        } else if (Ext == '1') {
          decoded.ext_sensor = 'Temperature Sensor';
          decoded.temperature_probe = parseFloat(
            ((((bytes[7] << 24) >> 16) | bytes[8]) / 100).toFixed(2)
          );
        } else if (Ext == '4') {
          decoded.work_mode = 'Interrupt Sensor send';
          decoded.ext_pin_level = bytes[7] ? 'High' : 'Low';
          decoded.ext_status = bytes[8] ? 'True' : 'False';
        } else if (Ext == '5') {
          decoded.work_mode = 'Illumination Sensor';
          decoded.illumination = (bytes[7] << 8) | bytes[8];
        } else if (Ext == '6') {
          decoded.work_mode = 'ADC Sensor';
          decoded.adc_voltage = ((bytes[7] << 8) | bytes[8]) / 1000;
        } else if (Ext == '7') {
          decoded.work_mode = 'Interrupt Sensor count';
          decoded.ext_count = (bytes[7] << 8) | bytes[8];
        } else if (Ext == '8') {
          decoded.work_mode = 'Interrupt Sensor count';
          decoded.ext_count =
            (bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10];
        } else if (Ext == '9') {
          decoded.work_mode = 'DS18B20 & timestamp';
          decoded.Systimestamp =
            (bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10];
        } else if (Ext == '15') {
          decoded.work_mode = 'DS18B20ID';
          decoded.ID =
            str_pad(bytes[2]) +
            str_pad(bytes[3]) +
            str_pad(bytes[4]) +
            str_pad(bytes[5]) +
            str_pad(bytes[7]) +
            str_pad(bytes[8]) +
            str_pad(bytes[9]) +
            str_pad(bytes[10]);
        }
      }
      if (bytes.length == 11) {
        return decoded;
      }
      break;

    case 1:
      {
        for (var i = 0; i < bytes.length; i = i + 11) {
          var da = datalog(i, bytes);
          if (i == '0') decoded.datalog = da;
          else decoded.datalog += da;
        }
      }
      return decoded;

    default:
      return {
        errors: ['unknown'],
      };
  }

  return decoded;
}

// Direct node.js CLI wrapper (payload bytes and port as argument)
// node decoder.js <payload_hex_string> <port>
try {
  console.log(Decoder(Buffer.from(process.argv[2], 'hex'), process.argv[3]));
} catch (err) {}
