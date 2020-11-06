type ConfigOptions = {
  basicToken: string;
};

const AstronomyAPI = class {
  private params: ConfigOptions;
  private apiBaseUrl: string = "https://api.astronomyapi.com";

  moonPhase = (
    params: {
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
    },
    callback: Function
  ) => {
    const req = new XMLHttpRequest();

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
      params
    );

    req.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status == 200) {
          const result = JSON.parse(this.responseText);

          const el = document.querySelector(params.element);

          if (el) {
            const image = new Image();
            image.src = result.data.imageUrl;
            el.append(image);
          }

          if (callback) {
            callback(result);
          }
        } else if (this.status == 422) {
          console.error(JSON.parse(this.responseText));
        } else {
          console.error("unknown error");
        }
      }
    };

    req.open("POST", `${this.apiBaseUrl}/api/v2/studio/moon-phase`, true);

    req.setRequestHeader("Content-Type", "application/json");
    req.setRequestHeader("Authorization", `Basic ${this.params.basicToken}`);

    req.send(JSON.stringify(params));
  };

  starChart = (
    params: {
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
    },
    callback: Function
  ) => {
    const req = new XMLHttpRequest();

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
      params
    );

    req.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status == 200) {
          const result = JSON.parse(this.responseText);

          const el = document.querySelector(params.element);

          if (el) {
            const image = new Image();
            image.src = result.data.imageUrl;
            el.append(image);
          }

          if (callback) {
            callback(result);
          }
        } else if (this.status == 422) {
          console.error(JSON.parse(this.responseText));
        } else {
          console.error("unknown error");
        }
      }
    };

    req.open("POST", `${this.apiBaseUrl}/api/v2/studio/star-chart`, true);

    req.setRequestHeader("Content-Type", "application/json");
    req.setRequestHeader("Authorization", `Basic ${this.params.basicToken}`);

    req.send(JSON.stringify(params));
  };

  constructor(params: ConfigOptions) {
    this.params = params;
  }
};

window["AstronomyAPI"] = AstronomyAPI;
