

 function initMap() {
   //var marker;

	 // Create a new StyledMapType object, passing it an array of styles,
	 // and the name to be displayed on the map type control.
	 var styledMapType = new google.maps.StyledMapType(
			 [
				 {elementType: 'geometry', stylers: [{color: '#ebe3cd'}]},
				 {elementType: 'labels.text.fill', stylers: [{color: '#523735'}]},
				 {elementType: 'labels.text.stroke', stylers: [{color: '#f5f1e6'}]},
				 {
					 featureType: 'administrative',
					 elementType: 'geometry.stroke',
					 stylers: [{color: '#c9b2a6'}]
				 },
				 {
					 featureType: 'administrative.land_parcel',
					 elementType: 'geometry.stroke',
					 stylers: [{color: '#dcd2be'}]
				 },
				 {
					 featureType: 'administrative.land_parcel',
					 elementType: 'labels.text.fill',
					 stylers: [{color: '#ae9e90'}]
				 },
				 {
					 featureType: 'landscape.natural',
					 elementType: 'geometry',
					 stylers: [{color: '#efeeec'}]
				 },
				 {
					 featureType: 'poi',
					 elementType: 'geometry',
					 stylers: [{color: '#dfd2ae'}]
				 },
				 {
					 featureType: 'poi',
					 elementType: 'labels.text.fill',
					 stylers: [{color: '#000000'}]
				 },
				 {
					 featureType: 'poi.park',
					 elementType: 'geometry.fill',
					 stylers: [{color: '#d0c9b7'}]
				 },
				 {
					 featureType: 'poi.park',
					 elementType: 'labels.text.fill',
					 stylers: [{color: '#000000'}]
				 },
				 {
					 featureType: 'road',
					 elementType: 'geometry',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'road.arterial',
					 elementType: 'geometry',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'road.highway',
					 elementType: 'geometry',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'road.highway',
					 elementType: 'geometry.stroke',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'road.highway.controlled_access',
					 elementType: 'geometry',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'road.highway.controlled_access',
					 elementType: 'geometry.stroke',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'road.local',
					 elementType: 'labels.text.fill',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'transit.line',
					 elementType: 'geometry',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'transit.line',
					 elementType: 'labels.text.fill',
					 stylers: [{color: '#8f7d77'}]
				 },
				 {
					 featureType: 'transit.line',
					 elementType: 'labels.text.stroke',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'transit.station',
					 elementType: 'geometry',
					 stylers: [{color: '#ffffff'}]
				 },
				 {
					 featureType: 'water',
					 elementType: 'geometry.fill',
					 stylers: [{color: '#e2d8c0'}]
				 },
				 {
					 featureType: 'water',
					 elementType: 'labels.text.fill',
					 stylers: [{color: '#e2d8c0'}]
				 }
			 ],
			 {name: 'Styled Map'});

 var map = new google.maps.Map(document.getElementById('map'), {
	 zoom: 10,
	 center: {lat: 42.581452, lng: 11.1492732}
 });

	 map.mapTypes.set('styled_map', styledMapType);
	 map.setMapTypeId('styled_map')

 marker = new google.maps.Marker({
	 map: map,
	 draggable: true,
	 animation: google.maps.Animation.DROP,
	 title: 'Argentaria',
	 position: {lat: 42.581452, lng: 11.1492732}


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
