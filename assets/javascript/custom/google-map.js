

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
        [
          {
              "featureType": "administrative",
              "elementType": "geometry",
              "stylers": [
                {
                  "color": "#804040"
                }
              ]
            },
            {
                "featureType": "administrative",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#000040"
                  }
                ]
              },
              {
                "featureType": "administrative",
                "elementType": "geometry.stroke",
                "stylers": [
                  {
                    "color": "#000040"
                  }
                ]
              },
              {
                "featureType": "administrative.country",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#800000"
                  },
                  {
                    "visibility": "on"
                  }
                ]
              },
              {
                "featureType": "administrative.country",
                "elementType": "geometry.stroke",
                "stylers": [
                  {
                    "color": "#800000"
                  }
                ]
              },
              {
                "featureType": "administrative.country",
                "elementType": "labels.text",
                "stylers": [
                  {
                    "color": "#808000"
                  },
                  {
                    "visibility": "simplified"
                  }
                ]
              },
              {
                "featureType": "administrative.land_parcel",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "visibility": "on"
                  }
                ]
              },
              {
                "featureType": "administrative.land_parcel",
                "elementType": "geometry.stroke",
                "stylers": [
                  {
                    "visibility": "simplified"
                  }
                ]
              },
              {
                "featureType": "administrative.locality",
                "stylers": [
                  {
                    "visibility": "off"
                  }
                ]
              },
              {
                "featureType": "administrative.locality",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "visibility": "on"
                  }
                ]
              },
              {
                "featureType": "administrative.neighborhood",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "visibility": "simplified"
                  }
                ]
              },
              {
                "featureType": "landscape.man_made",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#818285"
                  },
                  {
                    "saturation": 20
                  },
                  {
                    "lightness": 45
                  }
                ]
              },
              {
                "featureType": "landscape.man_made",
                "elementType": "geometry.stroke",
                "stylers": [
                  {
                    "color": "#000000"
                  },
                  {
                    "visibility": "on"
                  }
                ]
              },
              {
                "featureType": "landscape.man_made",
                "elementType": "labels.text.fill",
                "stylers": [
                  {
                    "saturation": 50
                  },
                  {
                    "lightness": -40
                  }
                ]
              },
              {
                "featureType": "landscape.natural",
                "elementType": "geometry.stroke",
                "stylers": [
                  {
                    "color": "#408080"
                  }
                ]
              },
              {
                "featureType": "landscape.natural.landcover",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "saturation": -20
                  },
                  {
                    "lightness": 100
                  }
                ]
              },
              {
                "featureType": "landscape.natural.terrain",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "visibility": "simplified"
                  }
                ]
              },
              {
                "featureType": "poi.park",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "saturation": 35
                  },
                  {
                    "lightness": 35
                  }
                ]
              },
              {
                "featureType": "poi.place_of_worship",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#000000"
                  }
                ]
              },
              {
                "featureType": "road.arterial",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#cfb63a"
                  },
                  {
                    "saturation": 100
                  },
                  {
                    "lightness": 25
                  },
                  {
                    "weight": 2.5
                  }
                ]
              },
              {
                "featureType": "road.arterial",
                "elementType": "geometry.stroke",
                "stylers": [
                  {
                    "color": "#cfb63a"
                  }
                ]
              },
              {
                "featureType": "road.highway",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#3c94c4"
                  },
                  {
                    "lightness": 45
                  }
                ]
              },
              {
                "featureType": "road.highway.controlled_access",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#ff8000"
                  }
                ]
              },
              {
                "featureType": "road.local",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#cfbb52"
                  },
                  {
                    "lightness": 5
                  },
                  {
                    "weight": 4
                  }
                ]
              },
              {
                "featureType": "transit.station.bus",
                "elementType": "geometry",
                "stylers": [
                  {
                    "color": "#80ff00"
                  }
                ]
              },
              {
                "featureType": "transit.station.bus",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#000000"
                  }
                ]
              },
              {
                "featureType": "transit.station.rail",
                "elementType": "geometry.fill",
                "stylers": [
                  {
                    "color": "#000000"
                  }
                ]
              }				 
			 ],
			 {name: 'Styled Map'});

 var map = new google.maps.Map(document.getElementById('map'), {
	 zoom: 19,
	 center: {lat: 45.48108850000001, lng: 9.208886399999983}
 });

	 map.mapTypes.set('styled_map', styledMapType);
	 map.setMapTypeId('styled_map')

 marker = new google.maps.Marker({
	 map: map,
	 draggable: true,
	 animation: google.maps.Animation.DROP,
	 title: 'Argentaria',
	 position: {lat: 45.48108850000001, lng: 9.208886399999983}


 });
 marker.addListener('click', toggleBounce);
}


function toggleBounce() {
if (marker.getAnimation() !== null) {
marker.setAnimation(null);
} else {
marker.setAnimation(google.maps.Animation.BOUNCE);
}
}
