function Decoder(bytes, port) {
  var decoded = {};

  // Do all the normal decoding for the sensor
  // decoded.temperature = (bytes[0] << 8 | bytes[1]) / 100 ...
  // ...

  // Test for LoRa properties in Datacake normalizedPayload
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

  // Test for location data in Datacake rawPayload
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

  // return location data only if it has a value not Zero
  if (
    baseStationLatitude !== 0 &&
    baseStationLongitude !== 0 &&
    baseStationsCount !== 0
  ) {
    decoded.location =
      '(' + baseStationLatitude + ',' + baseStationLongitude + ')';
    decoded.locations_count = baseStationsCount;
  }
  // Return Datacake object
  return decoded;
}
