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
  style: string;
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
  ) {
    if (widgetType == "moon-phase") {
      el.style.width = viewType == "portrait-simple" ? "200px" : "260px";
      el.style.height = viewType == "portrait-simple" ? "260px" : "160px";
    }

    if (widgetType == "star-chart") {
      el.style.width = "800px";
      el.style.height = "617px";
    }
  }

  private request(
    endpoint: string,
    params: object,
    callback: Function,
    el: HTMLElement,
  ) {
    const req = new XMLHttpRequest();

    const that = this;

    req.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status == 200) {
          const result = <APIResponse>JSON.parse(this.responseText);

          if (el) {
            const image = new Image();
            image.src = result.data.imageUrl;
            el.replaceChildren(image);
          }

          if (callback) {
            callback(result);
          }
        } else if (this.status == 422) {
          console.error(JSON.parse(this.responseText));
        } else {
          console.error("unknown error");
          el.replaceChildren(that.getPlaceholder("Error"));
        }
      }
    };

    req.open("POST", `${this.apiBaseUrl}/${endpoint}`, true);

    req.setRequestHeader("Content-Type", "application/json");
    req.setRequestHeader("Authorization", `Basic ${this.params.basicToken}`);

    req.send(JSON.stringify(params));
  }

  moonPhase = (params: MoonPhaseParameters, callback: Function) => {
    params = Object.assign(
      {
        element: "#moon-phase",
        format: "png",
        style: {
          moonStyle: "default",
          backgroundStyle: "stars",
          backgroundColor: "black",
          headingColor: "white",
          textColor: "white",
        },
        observer: {
          latitude: 0,
          longitude: 0,
          date: new Date().toISOString(),
        },
        view: {
          type: "portrait-simple",
        },
      },
      params,
    );

    const el = <HTMLElement>document.querySelector(params.element);

    this.setContainerSize("moon-phase", el, params.view.type);

    el.append(this.getPlaceholder("Loading..."));

    this.request("api/v2/studio/moon-phase", params, callback, el);
  };

  starChart = (params: StarChartParameters, callback: Function) => {
    params = Object.assign(
      {
        element: "#star-chart",
        style: "default",
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
      },
      params,
    );

    const el = <HTMLElement>document.querySelector(params.element);

    this.setContainerSize("star-chart", el, params.view.type);

    el.append(this.getPlaceholder("Loading..."));

    this.request("api/v2/studio/star-chart", params, callback, el);
  };

  constructor(params: ConfigOptions) {
    this.params = params;
  }
};

window["AstronomyAPI"] = AstronomyAPI;
