export const SOURCE_URLS = {
  address: "https://data.wake.gov/datasets/bc9728cd700e40cca91e9411bf47876c",
  parcel: "https://data.wake.gov/datasets/f5ed009c66e844ec82f29064edd95017",
  requests: "https://www.arcgis.com/home/item.html?id=54adb38aba1c4781927e6245dd1409d0",
  permits: "https://data-ral.opendata.arcgis.com/datasets/ral::building-permits/about",
  police: "https://raleighnc.gov/apps-maps-and-open-data/services/raleighs-crime-data",
  flood: "https://raleighnc.gov/ask-raleigh-fix-report-request/services/find-your-services",
  recordsRequest: "https://raleighnc.gov/ask-raleigh-fix-report-request/services/records-request",
  imaps: "https://maps.raleighnc.gov/imaps/",
};

export const ENDPOINTS = {
  addresses: "https://maps.wake.gov/arcgis/rest/services/Property/Addresses/MapServer/0/query",
  parcels: "https://maps.wake.gov/arcgis/rest/services/Property/Parcels/MapServer/0/query",
  requests: "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Ask_Raleigh_Requests/FeatureServer/0/query",
  permits: "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Building_Permits/FeatureServer/0/query",
  police: "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Police_Incidents/FeatureServer/0/query",
  flood: "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Flood_Hazard_Areas_ClipPlanJD/FeatureServer/114/query",
};

export const SOURCE_DEFINITIONS = [
  {
    id: "wake-address",
    name: "Wake County parcel address points",
    scope: "Exact address resolution",
    cadence: "Updated nightly",
    url: SOURCE_URLS.address,
  },
  {
    id: "wake-parcel",
    name: "Wake County parcels",
    scope: "Parcel facts and jurisdiction",
    cadence: "Updated each business day",
    url: SOURCE_URLS.parcel,
  },
  {
    id: "ask-raleigh",
    name: "Ask Raleigh service requests",
    scope: "Nearby complaints and service requests, including unsafe housing and public nuisance",
    cadence: "Updated twice daily",
    url: SOURCE_URLS.requests,
  },
  {
    id: "building-permits",
    name: "Raleigh building permits",
    scope: "Permit applications, status, work description, and completion fields",
    cadence: "Updated daily",
    url: SOURCE_URLS.permits,
  },
  {
    id: "police-incidents",
    name: "Raleigh police incidents",
    scope: "Reported incidents within one quarter mile during the last 12 months",
    cadence: "Updated daily",
    url: SOURCE_URLS.police,
  },
  {
    id: "flood-hazard",
    name: "Raleigh flood hazard areas",
    scope: "FEMA flood-zone polygon at the resolved address point",
    cadence: "City-hosted reference layer",
    url: SOURCE_URLS.flood,
  },
];
