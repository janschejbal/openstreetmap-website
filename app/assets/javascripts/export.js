function startExport(sidebarHtml) {
  var vectors;
  var box;
  var transform;
  var markerLayer;
  var markerControl;

  vectors = new OpenLayers.Layer.Vector("Vector Layer", {
    displayInLayerSwitcher: false
  });
  map.addLayer(vectors);

  box = new OpenLayers.Control.DrawFeature(vectors, OpenLayers.Handler.RegularPolygon, {
    handlerOptions: {
      sides: 4,
      snapAngle: 90,
      irregular: true,
      persist: true
    }
  });
  box.handler.callbacks.done = endDrag;
  map.addControl(box);

  transform = new OpenLayers.Control.TransformFeature(vectors, {
    rotate: false,
    irregular: true
  });
  transform.events.register("transformcomplete", transform, transformComplete);
  map.addControl(transform);

  map.events.register("moveend", map, mapMoved);
  map.events.register("changebaselayer", map, htmlUrlChanged);

  $("#sidebar_title").html(I18n.t('export.start_rjs.export'));
  $("#sidebar_content").html(sidebarHtml);

  $("#maxlat").change(boundsChanged);
  $("#minlon").change(boundsChanged);
  $("#maxlon").change(boundsChanged);
  $("#minlat").change(boundsChanged);

  $("#drag_box").click(startDrag);

  $("#add_marker").click(startMarker);

  $("#format_osm").click(formatChanged);
  $("#format_mapnik").click(formatChanged);
  $("#format_html").click(formatChanged);

  $("#mapnik_scale").change(mapnikSizeChanged);

  openSidebar({ onclose: stopExport });

  if (map.baseLayer.name == "Mapnik") {
    $("#format_mapnik").prop("checked", true);
  }

  formatChanged();
  setBounds(map.getExtent());

  $("#viewanchor").removeClass("active");
  $("#exportanchor").addClass("active");

  function stopExport() {
    $("#viewanchor").addClass("active");
    $("#exportanchor").removeClass("active");

    clearBox();
    clearMarker();
    map.events.unregister("moveend", map, mapMoved);
    map.events.unregister("changebaselayer", map, htmlUrlChanged);
    map.removeLayer(vectors);
  }

  function boundsChanged() {
    var epsg4326 = new OpenLayers.Projection("EPSG:4326");
    var bounds = new OpenLayers.Bounds($("#minlon").val(), $("#minlat").val(),
                                       $("#maxlon").val(), $("#maxlat").val());

    bounds.transform(epsg4326, map.getProjectionObject());

    map.events.unregister("moveend", map, mapMoved);
    map.zoomToExtent(bounds);

    clearBox();
    drawBox(bounds);

    validateControls();
    mapnikSizeChanged();
  }

  function startDrag() {
    $("#drag_box").html(I18n.t('export.start_rjs.drag_a_box'));

    clearBox();
    box.activate();
  };

  function endDrag(bbox) {
    var bounds = bbox.getBounds();

    map.events.unregister("moveend", map, mapMoved);
    setBounds(bounds);
    drawBox(bounds);
    box.deactivate();
    validateControls();

    $("#drag_box").html(I18n.t('export.start_rjs.manually_select'));
  }

  function transformComplete(event) {
    setBounds(event.feature.geometry.bounds);
    validateControls();
  }

  function startMarker() {
    $("#add_marker").html(I18n.t('export.start_rjs.click_add_marker'));

    if (!markerLayer) {
      markerLayer = new OpenLayers.Layer.Vector("",{
        displayInLayerSwitcher: false,
        style: {
          externalGraphic: OpenLayers.Util.getImageLocation("marker.png"),
          graphicXOffset: -10.5,
          graphicYOffset: -25,
          graphicWidth: 21,
          graphicHeight: 25
        }
      });
      map.addLayer(markerLayer);

      markerControl = new OpenLayers.Control.DrawFeature(markerLayer, OpenLayers.Handler.Point);
      map.addControl(markerControl);

      markerLayer.events.on({ "featureadded": endMarker });
    }

    markerLayer.destroyFeatures();
    markerControl.activate();

    return false;
  }

  function endMarker(event) {
    markerControl.deactivate();

    $("#add_marker").html(I18n.t('export.start_rjs.change_marker'));
    $("#marker_inputs").show();

    var epsg4326 = new OpenLayers.Projection("EPSG:4326");
    var epsg900913 = new OpenLayers.Projection("EPSG:900913");
    var geom = event.feature.geometry.clone().transform(epsg900913, epsg4326);

    $("#marker_lon").val(geom.x.toFixed(5));
    $("#marker_lat").val(geom.y.toFixed(5));

    htmlUrlChanged();
  }

  function clearMarker() {
    $("#marker_lon").val("");
    $("#marker_lat").val("");
    $("#marker_inputs").hide();
    $("#add_marker").html(I18n.t('export.start_rjs.add_marker'));

    if (markerLayer) {
      markerControl.destroy();
      markerLayer.destroy();
      markerLayer = null;
      markerControl = null;
    }
  }

  function mapMoved() {
    setBounds(map.getExtent());
    validateControls();
  }

  function setBounds(bounds) {
    var epsg4326 = new OpenLayers.Projection("EPSG:4326");
    var decimals = Math.pow(10, Math.floor(map.getZoom() / 3));

    bounds = bounds.clone().transform(map.getProjectionObject(), epsg4326);

    $("#minlon").val(Math.round(bounds.left * decimals) / decimals);
    $("#minlat").val(Math.round(bounds.bottom * decimals) / decimals);
    $("#maxlon").val(Math.round(bounds.right * decimals) / decimals);
    $("#maxlat").val(Math.round(bounds.top * decimals) / decimals);

    mapnikSizeChanged();
    htmlUrlChanged();
  }

  function clearBox() {
    transform.deactivate();
    vectors.destroyFeatures();
  }

  function drawBox(bounds) {
    var feature = new OpenLayers.Feature.Vector(bounds.toGeometry());

    vectors.addFeatures(feature);
    transform.setFeature(feature);
  }

  function validateControls() {
    var bounds = new OpenLayers.Bounds($("#minlon").val(), $("#minlat").val(), $("#maxlon").val(), $("#maxlat").val());

    if (bounds.getWidth() * bounds.getHeight() > OSM.MAX_REQUEST_AREA) {
      $("#export_osm_too_large").show();
    } else {
      $("#export_osm_too_large").hide();
    }

    var max_scale = maxMapnikScale();
    var disabled = true;

    if ($("#format_osm").prop("checked")) {
      disabled = bounds.getWidth() * bounds.getHeight() > OSM.MAX_REQUEST_AREA;
    } else if ($("#format_mapnik").prop("checked")) {
      disabled = $("#mapnik_scale").val() < max_scale;
    }

    $("#export_commit").prop("disabled", disabled);
    $("#mapnik_max_scale").html(roundScale(max_scale));
  }

  function htmlUrlChanged() {
    var bounds = new OpenLayers.Bounds($("#minlon").val(), $("#minlat").val(), $("#maxlon").val(), $("#maxlat").val());
    var layerName = map.baseLayer.keyid;
    var url = "http://" + OSM.SERVER_URL + "/export/embed.html?bbox=" + bounds.toBBOX() + "&amp;layer=" + layerName;
    var markerUrl = "";

    if ($("#marker_lat").val() && $("#marker_lon").val()) {
      markerUrl = "&amp;mlat=" + $("#marker_lat").val() + "&amp;mlon=" + $("#marker_lon").val();
      url += "&amp;marker=" + $("#marker_lat").val() + "," + $("#marker_lon").val();
    }

    var html = '<iframe width="425" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="'+url+'" style="border: 1px solid black"></iframe>';

    // Create "larger map" link
    var center = bounds.getCenterLonLat();
    var epsg4326 = new OpenLayers.Projection("EPSG:4326");
    var epsg900913 = new OpenLayers.Projection("EPSG:900913");

    bounds.transform(epsg4326, epsg900913);
    var zoom = map.getZoomForExtent(bounds);

    var layers = getMapLayers();

    var text = I18n.t('export.start_rjs.view_larger_map');
    var escaped = [];

    for (var i = 0; i < text.length; ++i) {
      var c = text.charCodeAt(i);
      escaped.push(c < 127 ? text.charAt(i) : "&#" + c + ";");
    }

    html += '<br /><small><a href="http://' + OSM.SERVER_URL + '/?lat='+center.lat+'&amp;lon='+center.lon+'&amp;zoom='+zoom+'&amp;layers='+layers+markerUrl+'">'+escaped.join("")+'</a></small>';

    $("#export_html_text").val(html);

    if ($("#format_html").prop("checked")) {
      $("#export_html_text").prop("selected", true);
    }
  }

  function formatChanged() {
    $("#export_commit").show();

    if ($("#format_osm").prop("checked")) {
      $("#export_osm").show();
    } else {
      $("#export_osm").hide();
    }

    if ($("#format_mapnik").prop("checked")) {
      $("#mapnik_scale").val(roundScale(map.getScale()));
      $("#export_mapnik").show();

      mapnikSizeChanged();
    } else {
      $("#export_mapnik").hide();
    }

    if ($("#format_html").prop("checked")) {
      $("#export_html").show();
      $("#export_commit").hide();
      $("#export_html_text").prop("selected", true);
    } else {
      $("#export_html").hide();

      clearMarker();
    }

    validateControls();
  }

  function maxMapnikScale() {
    var bounds = new OpenLayers.Bounds($("#minlon").val(), $("#minlat").val(), $("#maxlon").val(), $("#maxlat").val());
    var epsg4326 = new OpenLayers.Projection("EPSG:4326");
    var epsg900913 = new OpenLayers.Projection("EPSG:900913");

    bounds.transform(epsg4326, epsg900913);

    return Math.floor(Math.sqrt(bounds.getWidth() * bounds.getHeight() / 0.3136));
  }

  function mapnikImageSize(scale) {
    var bounds = new OpenLayers.Bounds($("#minlon").val(), $("#minlat").val(), $("#maxlon").val(), $("#maxlat").val());
    var epsg4326 = new OpenLayers.Projection("EPSG:4326");
    var epsg900913 = new OpenLayers.Projection("EPSG:900913");

    bounds.transform(epsg4326, epsg900913);

    return new OpenLayers.Size(Math.round(bounds.getWidth() / scale / 0.00028),
                               Math.round(bounds.getHeight() / scale / 0.00028));
  }

  function roundScale(scale) {
    var precision = 5 * Math.pow(10, Math.floor(Math.LOG10E * Math.log(scale)) - 2);

    return precision * Math.ceil(scale / precision);
  }

  function mapnikSizeChanged() {
    var size = mapnikImageSize($("#mapnik_scale").val());

    $("#mapnik_image_width").html(size.w);
    $("#mapnik_image_height").html(size.h);

    validateControls();
  }
}
