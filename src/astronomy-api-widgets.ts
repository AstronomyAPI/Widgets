type ConfigOptions = {
  basicToken: string;
};

type MoonPhaseParameters = {
  element: string;
  format: string;
  style: {
    moonStyle: string;
    backgroundStyle: string;
    backgroundColor: string;
    headingColor: string;
    textColor: string;
    width?: string;
    height?: string;
  };
  observer: {
    latitude: number;
    longitude: number;
    date: string;
  };
  view: {
    type: string;
  };
};

type StarChartParameters = {
  element: string;
  style: {
    type: string;
    width?: string;
    height?: string;
  };
  observer: {
    latitude: number;
    longitude: number;
    date: string;
  };
  view: {
    type: string;
    parameters: {
      position: {
        equatorial: {
          rightAscension: number;
          declination: number;
        };
      };
      zoom: number;
    };
  };
};

type APIResponse = {
  data: {
    imageUrl: string;
  };
};

// Regex constants for validation
const REGEX_CSS_COLOR = /^(#([0-9a-f]{3}){1,2}|(rgb|rgba)\([\d\s,.]+\)|[a-z]+)$/i;
const REGEX_CSS_SIZE = /^\d+(\.\d+)?(px|em|%|vh|vw)$/;
const REGEX_ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const REGEX_CONSTELLATION_CODE = /^[a-zA-Z]{3}$/;

// Validation Helper Functions
function validateStringEnum<T extends string>(
  value: T,
  allowedValues: T[],
  defaultValue: T,
  paramName: string,
  widgetName: string
): T {
  if (allowedValues.includes(value)) {
    return value;
  }
  console.warn(`AstronomyAPI (${widgetName}): Invalid ${paramName} ('${value}') provided. Allowed values are: ${allowedValues.join(", ")}. Defaulting to '${defaultValue}'.`);
  return defaultValue;
}

function validateCssColor(
  color: string,
  defaultValue: string,
  paramName: string,
  widgetName: string
): string {
  if (REGEX_CSS_COLOR.test(color)) {
    return color;
  }
  console.warn(`AstronomyAPI (${widgetName}): Invalid ${paramName} ('${color}') provided. Must be a valid CSS color. Defaulting to '${defaultValue}'.`);
  return defaultValue;
}

function validateCssSize(
  size: string | undefined,
  paramName: string,
  widgetName: string
): string | undefined {
  if (size === undefined) {
    return undefined; // Optional parameter, not provided
  }
  if (REGEX_CSS_SIZE.test(size)) {
    return size;
  }
  console.warn(`AstronomyAPI (${widgetName}): Invalid ${paramName} ('${size}') provided. Must be a valid CSS size (e.g., '100px', '5em'). Ignoring value.`);
  return undefined; // Ignore invalid value
}

function validateNumberRange(
  value: number,
  min: number,
  max: number,
  defaultValue: number,
  paramName: string,
  widgetName: string
): number {
  if (typeof value === 'number' && !isNaN(value) && value >= min && value <= max) {
    return value;
  }
  console.warn(`AstronomyAPI (${widgetName}): Invalid ${paramName} ('${value}') provided. Must be a number between ${min} and ${max}. Defaulting to ${defaultValue}.`);
  return defaultValue;
}

function validateIsoDate(
  dateStr: string,
  defaultValueProvider: () => string, // Use a provider for dynamic default date
  paramName: string,
  widgetName: string
): string {
  if (REGEX_ISO_DATE.test(dateStr)) {
    // Further check if it's a parsable date, though regex is quite strict
    if (!isNaN(new Date(dateStr).getTime())) {
      return dateStr;
    }
  }
  console.warn(`AstronomyAPI (${widgetName}): Invalid ${paramName} ('${dateStr}') provided. Must be a valid ISO 8601 date string. Defaulting to current date.`);
  return defaultValueProvider();
}

function validateConstellationCode(
  code: string,
  defaultValue: string,
  paramName: string,
  widgetName: string
): string {
  if (REGEX_CONSTELLATION_CODE.test(code)) {
    return code.toUpperCase(); // Standardize to uppercase
  }
  console.warn(`AstronomyAPI (${widgetName}): Invalid ${paramName} ('${code}') provided. Must be a 3-letter IAU constellation code. Defaulting to '${defaultValue}'.`);
  return defaultValue;
}


// Define default parameters outside the class for use in method signatures
const DEFAULT_MOON_PHASE_PARAMS: MoonPhaseParameters = {
  element: "#moon-phase",
  format: "png",
  style: {
    moonStyle: "default",
    backgroundStyle: "stars",
    backgroundColor: "black",
    headingColor: "white",
    textColor: "white",
    // width and height are optional, so not included in defaults
  },
  observer: {
    latitude: 0,
    longitude: 0,
    date: new Date().toISOString(),
  },
  view: {
    type: "portrait-simple",
  },
};

const DEFAULT_STAR_CHART_PARAMS: StarChartParameters = {
  element: "#star-chart",
  style: {
    type: "default",
    // width and height are optional, so not included in defaults
  },
  observer: {
    latitude: 0,
    longitude: 0,
    date: new Date().toISOString(),
  },
  view: {
    type: "area",
    parameters: {
      position: {
        equatorial: {
          rightAscension: 12.83,
          declination: -15.23,
        },
      },
      zoom: 3,
    },
  },
};

const AstronomyAPI = class {
  private params: ConfigOptions;
  private apiBaseUrl: string = "https://api.astronomyapi.com";

  private getPlaceholder(text: string) {
    const placeholder = document.createElement("p");

    placeholder.style.fontSize = "10px";
    placeholder.style.color = "#444";
    placeholder.style.textAlign = "center";
    placeholder.style.verticalAlign = "middle";

    placeholder.innerText = text;

    return placeholder;
  }

  private setContainerSize(
    widgetType: string,
    el: HTMLElement,
    viewType: string,
    styleParams?: { width?: string; height?: string }
  ) {
    if (widgetType == "moon-phase") {
      el.style.width = styleParams?.width || (viewType == "portrait-simple" ? "200px" : "260px");
      el.style.height = styleParams?.height || (viewType == "portrait-simple" ? "260px" : "160px");
    }

    if (widgetType == "star-chart") {
      el.style.width = styleParams?.width || "800px";
      el.style.height = styleParams?.height || "617px";
    }
  }

  private request(
    endpoint: string,
    params: object,
    callback: Function,
    el: HTMLElement
  ) {
    const controller = new AbortController();
    const signal = controller.signal;
    const timeoutDuration = 15000; // 15 seconds timeout

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutDuration);

    const that = this; // To access getPlaceholder in catch blocks

    fetch(`${this.apiBaseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${this.params.basicToken}`,
        "x-astronomy-api-source": "widgets",
      },
      body: JSON.stringify(params),
      signal: signal,
    })
      .then((response) => {
        clearTimeout(timeoutId); // Clear the timeout if the request completes

        if (response.status === 200) {
          return response.json().then((result: APIResponse) => {
            if (el) {
              const image = new Image();
              image.src = result.data.imageUrl;
              el.replaceChildren(image);
            }
            if (callback) {
              callback(result);
            }
          }).catch(e => {
            console.error("Error parsing API response:", e);
            el.replaceChildren(that.getPlaceholder("Error parsing API response"));
          });
        } else if (response.status === 422) {
          return response.json().then(errorResult => {
            console.error("Invalid parameters:", errorResult);
            el.replaceChildren(that.getPlaceholder("Invalid parameters sent to API"));
          }).catch(e => {
            console.error("Error parsing API error response (422):", e);
            el.replaceChildren(that.getPlaceholder("Invalid parameters sent to API (unable to parse error details)"));
          });
        } else {
          console.error(`API request failed with status: ${response.status}`);
          el.replaceChildren(
            that.getPlaceholder(`API request failed with status: ${response.status}`)
          );
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId); // Clear the timeout in case of error too
        if (error.name === 'AbortError') {
          console.error("API request timed out");
          el.replaceChildren(that.getPlaceholder("API request timed out"));
        } else {
          console.error("Network error occurred or other fetch error:", error);
          el.replaceChildren(that.getPlaceholder("Network error occurred"));
        }
      });
  }

  moonPhase = (
    userParams: Partial<MoonPhaseParameters> = {},
    callback: Function = () => {}
  ) => {
    // Initial merge with defaults
    let params: MoonPhaseParameters = {
      ...DEFAULT_MOON_PHASE_PARAMS,
      ...userParams,
      observer: {
        ...DEFAULT_MOON_PHASE_PARAMS.observer,
        ...(userParams.observer || {}),
        date: (userParams.observer?.date) ? userParams.observer.date : new Date().toISOString(),
      },
      style: {
        ...DEFAULT_MOON_PHASE_PARAMS.style,
        ...(userParams.style || {}),
      },
      view: {
        ...DEFAULT_MOON_PHASE_PARAMS.view,
        ...(userParams.view || {}),
      }
    };

    // --- Input Validation ---
    const widgetName = "moonPhase";

    // params.element is handled by querySelector check later

    params.format = validateStringEnum(params.format, ['png', 'svg'], DEFAULT_MOON_PHASE_PARAMS.format, 'format', widgetName);
    
    params.style.moonStyle = validateStringEnum(params.style.moonStyle, ['default', 'sketch', 'realistic'], DEFAULT_MOON_PHASE_PARAMS.style.moonStyle, 'style.moonStyle', widgetName);
    params.style.backgroundStyle = validateStringEnum(params.style.backgroundStyle, ['stars', 'solid', 'transparent'], DEFAULT_MOON_PHASE_PARAMS.style.backgroundStyle, 'style.backgroundStyle', widgetName);
    params.style.backgroundColor = validateCssColor(params.style.backgroundColor, DEFAULT_MOON_PHASE_PARAMS.style.backgroundColor, 'style.backgroundColor', widgetName);
    params.style.headingColor = validateCssColor(params.style.headingColor, DEFAULT_MOON_PHASE_PARAMS.style.headingColor, 'style.headingColor', widgetName);
    params.style.textColor = validateCssColor(params.style.textColor, DEFAULT_MOON_PHASE_PARAMS.style.textColor, 'style.textColor', widgetName);
    
    params.style.width = validateCssSize(params.style.width, 'style.width', widgetName);
    params.style.height = validateCssSize(params.style.height, 'style.height', widgetName);

    params.observer.latitude = validateNumberRange(params.observer.latitude, -90, 90, DEFAULT_MOON_PHASE_PARAMS.observer.latitude, 'observer.latitude', widgetName);
    params.observer.longitude = validateNumberRange(params.observer.longitude, -180, 180, DEFAULT_MOON_PHASE_PARAMS.observer.longitude, 'observer.longitude', widgetName);
    params.observer.date = validateIsoDate(params.observer.date, () => new Date().toISOString(), 'observer.date', widgetName);

    params.view.type = validateStringEnum(params.view.type, ['portrait-simple', 'portrait-detailed', 'landscape-simple', 'landscape-detailed'], DEFAULT_MOON_PHASE_PARAMS.view.type, 'view.type', widgetName);

    // Element existence check (remains from before)
    if (!params.element) { 
      console.warn(`AstronomyAPI (${widgetName}): 'element' parameter is effectively missing. Defaulting to '${DEFAULT_MOON_PHASE_PARAMS.element}'.`);
      params.element = DEFAULT_MOON_PHASE_PARAMS.element; 
    }
    
    const el = <HTMLElement>document.querySelector(params.element);

    if (!el) {
      console.error(`AstronomyAPI: Target element '${params.element}' not found in the DOM for moonPhase widget.`);
      return;
    }

    this.setContainerSize("moon-phase", el, params.view.type, params.style);

    el.append(this.getPlaceholder("Loading..."));

    this.request("api/v2/studio/moon-phase", params, callback, el);
  };

  starChart = (
    userParams: Partial<StarChartParameters> = {},
    callback: Function = () => {}
  ) => {
    // Initial merge with defaults
    let params: StarChartParameters = {
      ...DEFAULT_STAR_CHART_PARAMS,
      ...userParams,
      observer: {
        ...DEFAULT_STAR_CHART_PARAMS.observer,
        ...(userParams.observer || {}),
        date: (userParams.observer?.date) ? userParams.observer.date : new Date().toISOString(),
      },
      style: {
        ...DEFAULT_STAR_CHART_PARAMS.style,
        ...(userParams.style || {}),
      },
      view: {
        ...DEFAULT_STAR_CHART_PARAMS.view,
        ...(userParams.view || {}),
        parameters: {
          ...DEFAULT_STAR_CHART_PARAMS.view.parameters,
          ...((userParams.view || {}).parameters || {}),
          position: {
            ...DEFAULT_STAR_CHART_PARAMS.view.parameters.position,
            ...(((userParams.view || {}).parameters || {}).position || {}),
            equatorial: {
              ...DEFAULT_STAR_CHART_PARAMS.view.parameters.position.equatorial,
              ...(((((userParams.view || {}).parameters || {}).position || {}).equatorial || {})),
            },
          },
        },
      },
    };

    // --- Input Validation ---
    const widgetName = "starChart";

    // params.element is handled by querySelector check later

    params.style.type = validateStringEnum(params.style.type, ['default', 'constellation', 'red', 'nightvision', 'sketch', 'white'], DEFAULT_STAR_CHART_PARAMS.style.type, 'style.type', widgetName);
    params.style.width = validateCssSize(params.style.width, 'style.width', widgetName);
    params.style.height = validateCssSize(params.style.height, 'style.height', widgetName);

    params.observer.latitude = validateNumberRange(params.observer.latitude, -90, 90, DEFAULT_STAR_CHART_PARAMS.observer.latitude, 'observer.latitude', widgetName);
    params.observer.longitude = validateNumberRange(params.observer.longitude, -180, 180, DEFAULT_STAR_CHART_PARAMS.observer.longitude, 'observer.longitude', widgetName);
    params.observer.date = validateIsoDate(params.observer.date, () => new Date().toISOString(), 'observer.date', widgetName);

    params.view.type = validateStringEnum(params.view.type, ['area', 'constellation'], DEFAULT_STAR_CHART_PARAMS.view.type, 'view.type', widgetName);

    // Conditional validation based on view.type
    if (params.view.type === 'area') {
      if (params.view.parameters?.position?.equatorial) { // Ensure structure exists
        params.view.parameters.position.equatorial.rightAscension = validateNumberRange(params.view.parameters.position.equatorial.rightAscension, 0, 24, DEFAULT_STAR_CHART_PARAMS.view.parameters.position.equatorial.rightAscension, 'view.parameters.position.equatorial.rightAscension', widgetName);
        params.view.parameters.position.equatorial.declination = validateNumberRange(params.view.parameters.position.equatorial.declination, -90, 90, DEFAULT_STAR_CHART_PARAMS.view.parameters.position.equatorial.declination, 'view.parameters.position.equatorial.declination', widgetName);
      } else { // Should not happen with proper merging, but as a safeguard
        params.view.parameters = { ...DEFAULT_STAR_CHART_PARAMS.view.parameters };
      }
      params.view.parameters.zoom = validateNumberRange(params.view.parameters.zoom, 1, 10, DEFAULT_STAR_CHART_PARAMS.view.parameters.zoom, 'view.parameters.zoom', widgetName);
    } else if (params.view.type === 'constellation') {
      // Ensure 'parameters' exists, and 'constellation' exists within it.
      // The default structure for 'area' has 'position' and 'zoom', which are not relevant for 'constellation' view type.
      // So, when view.type is 'constellation', we might want to ensure these 'area' specific params are not there or are ignored.
      // For now, we only validate 'constellation' if view.type is 'constellation'.
      // The API might ignore irrelevant params, but it's good practice for the client to be clean.
      // We need to ensure params.view.parameters has the constellation property.
      // The default StarChartParameters has 'position' and 'zoom' under view.parameters, not 'constellation'.
      // This means if user sets view.type = 'constellation' but doesn't provide view.parameters.constellation, it will be undefined.
      
      const defaultConstellationCode = 'ORI'; // Uppercase default
      let currentConstellationCode = (params.view.parameters as any)?.constellation;

      if (typeof currentConstellationCode !== 'string') { // Check if it's not a string (e.g. undefined, or wrong type)
           console.warn(`AstronomyAPI (${widgetName}): view.type is 'constellation' but no 'view.parameters.constellation' string was provided. Defaulting to '${defaultConstellationCode}'.`);
           currentConstellationCode = defaultConstellationCode;
      }
      
      // Ensure parameters object exists before assigning constellation to it
      // This might not be strictly necessary due to the merging logic, but good for safety.
      if (!params.view.parameters) {
        // This case should ideally not be hit if merging is comprehensive,
        // as DEFAULT_STAR_CHART_PARAMS.view.parameters exists.
        // However, to be safe for type 'constellation' which alters structure:
        (params.view.parameters as any) = {}; 
      }

      (params.view.parameters as any).constellation = validateConstellationCode(currentConstellationCode, defaultConstellationCode, 'view.parameters.constellation', widgetName);
      
      // Optionally, remove area-specific params if view.type is 'constellation'
      // delete (params.view.parameters as any).position;
      // delete (params.view.parameters as any).zoom;
    }

    // Element existence check (remains from before)
    if (!params.element) {
      console.warn(`AstronomyAPI (${widgetName}): 'element' parameter is effectively missing. Defaulting to '${DEFAULT_STAR_CHART_PARAMS.element}'.`);
      params.element = DEFAULT_STAR_CHART_PARAMS.element;
    }

    const el = <HTMLElement>document.querySelector(params.element);

    if (!el) {
      console.error(`AstronomyAPI: Target element '${params.element}' not found in the DOM for starChart widget.`);
      return;
    }

    this.setContainerSize("star-chart", el, params.view.type, params.style);

    el.append(this.getPlaceholder("Loading..."));

    this.request("api/v2/studio/star-chart", params, callback, el);
  };

  constructor(params: ConfigOptions) {
    this.params = params;
    if (!params.basicToken || params.basicToken.length < 10) {
      throw new Error('`basicToken` must be set during construction')
    }
  }
};

window["AstronomyAPI"] = AstronomyAPI;
