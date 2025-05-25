// Import the class to be tested
// Annoyingly, because AstronomyAPI is exposed via window['AstronomyAPI']
// and not via a module export, we have to import the whole file to execute it
// and then access the class via window.
import './astronomy-api-widgets';

// Define the type for the class we are testing if not already globally available
// (it should be, due to the import above)
declare var AstronomyAPI: any;

describe('AstronomyAPI', () => {
  const VALID_TOKEN = 'test_token_longer_than_10_chars';
  let astronomyAPI: any;

  // Mock console.error and console.warn to spy on them
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset spies before each test
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console functions
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should instantiate successfully with a valid basicToken', () => {
      astronomyAPI = new AstronomyAPI({ basicToken: VALID_TOKEN });
      expect(astronomyAPI).toBeInstanceOf(AstronomyAPI);
    });

    it('should throw an error if basicToken is not provided', () => {
      expect(() => {
        new AstronomyAPI({});
      }).toThrow('`basicToken` must be set during construction');
    });

    it('should throw an error if basicToken is too short', () => {
      expect(() => {
        new AstronomyAPI({ basicToken: 'short' });
      }).toThrow('`basicToken` must be set during construction');
    });
  });

  describe('widget methods common setup', () => {
    let mockFetch: jest.Mock;
    const MOCK_IMAGE_URL = 'http://example.com/mock_image.png';
    const DEFAULT_ELEMENT_ID = 'test-widget';
    let widgetContainer: HTMLDivElement;

    beforeEach(() => {
      // Create a container for the widget
      widgetContainer = document.createElement('div');
      widgetContainer.id = DEFAULT_ELEMENT_ID;
      document.body.appendChild(widgetContainer);

      // Instantiate the API client
      astronomyAPI = new AstronomyAPI({ basicToken: VALID_TOKEN });

      // Mock global fetch
      mockFetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { imageUrl: MOCK_IMAGE_URL } }),
          text: () => Promise.resolve(JSON.stringify({ data: { imageUrl: MOCK_IMAGE_URL } }))
        })
      );
      global.fetch = mockFetch;
    });

    afterEach(() => {
      // Clean up the DOM
      if (widgetContainer) {
        document.body.removeChild(widgetContainer);
      }
      // Clear the mock
      mockFetch.mockClear();
      // Clean up spies
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    describe('moonPhase method', () => {
      const MOON_PHASE_ENDPOINT = 'api/v2/studio/moon-phase';

      it('should display "Loading...", then image on success, and call fetch with default params', async () => { 
        let resolveFetch: (value: any) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveFetch = r; }));

        astronomyAPI.moonPhase({ element: `#${DEFAULT_ELEMENT_ID}` });
        
        await Promise.resolve(); 
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Loading...');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(MOON_PHASE_ENDPOINT),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: `Basic ${VALID_TOKEN}`,'Content-Type': 'application/json'}),
            body: expect.stringContaining('"format":"png"')
          })
        );

        resolveFetch!({
          ok: true, status: 200, json: () => Promise.resolve({ data: { imageUrl: MOCK_IMAGE_URL } })
        });

        await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); // Flush promise chain

        expect(widgetContainer.querySelector('img')).not.toBeNull();
        expect(widgetContainer.querySelector('img')?.src).toBe(MOCK_IMAGE_URL);
        expect(widgetContainer.textContent).not.toContain('Loading...');
      });
      
      // This test is now largely covered by the one above for default params.
      // Keeping a slimmed down version for custom param check on body.
      it('should call fetch with custom parameters in body', () => {
        const customParams = {
          element: `#${DEFAULT_ELEMENT_ID}`,
          format: 'svg' as const,
          observer: { latitude: 10, longitude: 20, date: '2023-01-01T00:00:00Z' },
          style: { moonStyle: 'sketch' as const },
        };
        astronomyAPI.moonPhase(customParams);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(MOON_PHASE_ENDPOINT),
          expect.objectContaining({
            body: expect.stringContaining(JSON.stringify(customParams.format)),
          })
        );
         // More detailed body check for nested params (example)
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.observer.latitude).toBe(customParams.observer.latitude);
        expect(fetchCallBody.style.moonStyle).toBe(customParams.style.moonStyle);
      });

      it('should log error if target element is not found', () => {
        astronomyAPI.moonPhase({ element: '#non-existent-element' });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Target element '#non-existent-element' not found")
        );
      });

      it('should log warning if element parameter is missing and use default', async () => { 
        // Temporarily remove the default element to test this specific warning
        document.body.removeChild(widgetContainer);
        widgetContainer = document.createElement('div'); // create a new one
        widgetContainer.id = 'moon-phase'; // Default ID
        document.body.appendChild(widgetContainer);

        astronomyAPI.moonPhase({}); // No element provided
        await Promise.resolve(); // Wait for microtasks / JSDOM updates
        // The validation logic now ensures element is always set from default if not provided by user.
        // The original warning for *missing* element (pre-merge) is gone.
        // The current warning is if element is *effectively* missing post-merge (which shouldn't happen with defaults).
        // So, we test that it defaults to '#moon-phase' and proceeds.
        expect(mockFetch).toHaveBeenCalled(); // Check that it proceeded to fetch
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Loading...');
      });

      it('should warn and default for invalid observer.latitude', async () => { 
        astronomyAPI.moonPhase({ element: `#${DEFAULT_ELEMENT_ID}`, observer: { latitude: 200 }});
        await Promise.resolve(); // Wait for microtasks / JSDOM updates for consoleWarn
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid observer.latitude ('200')")
        );
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.observer.latitude).toBe(0); // Default latitude
      });
      
      it('should warn and default for invalid style.moonStyle', async () => { 
        astronomyAPI.moonPhase({ element: `#${DEFAULT_ELEMENT_ID}`, style: { moonStyle: 'invalid-style' }});
        await Promise.resolve(); // Wait for microtasks / JSDOM updates for consoleWarn
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid style.moonStyle ('invalid-style')")
        );
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.style.moonStyle).toBe('default'); // Default moonStyle
      });

      // Error Handling Tests
      it('should display "Loading..." then error message on 422 API error', async () => {
        let resolveFetch: (value: any) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveFetch = r; }));

        astronomyAPI.moonPhase({ element: `#${DEFAULT_ELEMENT_ID}` });
        
        await Promise.resolve();
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Loading...');

        resolveFetch!({
          ok: false, status: 422, json: () => Promise.resolve({ error: 'Invalid params' }), text: () => Promise.resolve(JSON.stringify({ error: 'Invalid params' }))
        });
        
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); 

        expect(widgetContainer.querySelector('p')?.innerText).toBe('Invalid parameters sent to API');
        expect(consoleErrorSpy).toHaveBeenCalledWith("Invalid parameters:", {"error": "Invalid params"});
      });

      it('should display "Loading..." then error message on other HTTP API error', async () => {
        mockFetch.mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}), 
            text: () => Promise.resolve("Internal Server Error")
          })
        );
        astronomyAPI.moonPhase({ element: `#${DEFAULT_ELEMENT_ID}` });
        await new Promise(process.nextTick); 
        await new Promise(process.nextTick); 
        await new Promise(process.nextTick); 
        expect(widgetContainer.querySelector('p')?.innerText).toBe('API request failed with status: 500');
        expect(consoleErrorSpy).toHaveBeenCalledWith("API request failed with status: 500");
      });
      
      it('should display "Loading..." then error message on network error', async () => {
        let rejectFetch: (reason?: any) => void;
        mockFetch.mockImplementationOnce(() => new Promise((_, rj) => { rejectFetch = rj; }));

        astronomyAPI.moonPhase({ element: `#${DEFAULT_ELEMENT_ID}` });

        await Promise.resolve();
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Loading...');

        rejectFetch!(new Error('Network failure'));
        
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(widgetContainer.querySelector('p')?.innerText).toBe('Network error occurred');
        expect(consoleErrorSpy).toHaveBeenCalledWith("Network error occurred or other fetch error:", new Error('Network failure'));
      });

      it('should display "Loading..." then error message on API response JSON parsing error', async () => {
        mockFetch.mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.reject(new Error('Malformed JSON')),
          })
        );
        astronomyAPI.moonPhase({ element: `#${DEFAULT_ELEMENT_ID}` });
        await new Promise(process.nextTick); 
        await new Promise(process.nextTick); 
        await new Promise(process.nextTick); 
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Error parsing API response');
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error parsing API response:", new Error('Malformed JSON'));
      });
    });

    describe('starChart method', () => {
      const STAR_CHART_ENDPOINT = 'api/v2/studio/star-chart';

      it('should display "Loading...", then image on success, and call fetch with default params', async () => {
        let resolveFetch: (value: any) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveFetch = r; }));
        
        astronomyAPI.starChart({ element: `#${DEFAULT_ELEMENT_ID}` });
        
        await Promise.resolve();
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Loading...');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(STAR_CHART_ENDPOINT),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"style":{"type":"default"}')
          })
        );

        resolveFetch!({
          ok: true, status: 200, json: () => Promise.resolve({ data: { imageUrl: MOCK_IMAGE_URL } })
        });

        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(widgetContainer.querySelector('img')).not.toBeNull();
        expect(widgetContainer.querySelector('img')?.src).toBe(MOCK_IMAGE_URL);
        expect(widgetContainer.textContent).not.toContain('Loading...');
      });
      
      // Slimmed down version for custom param check on body.
      it('should call fetch with custom parameters (e.g., view type area) in body', () => {
        const customParams = {
          element: `#${DEFAULT_ELEMENT_ID}`,
          observer: { latitude: 34, longitude: -118, date: '2023-02-01T00:00:00Z' },
          view: {
            type: 'area' as const,
            parameters: {
              position: { equatorial: { rightAscension: 5, declination: -30 } },
              zoom: 5,
            },
          },
        };
        astronomyAPI.starChart(customParams);
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.observer.latitude).toBe(customParams.observer.latitude);
        expect(fetchCallBody.view.type).toBe(customParams.view.type);
        expect(fetchCallBody.view.parameters.zoom).toBe(customParams.view.parameters.zoom);
      });
      
      it('should call fetch with view.type constellation and specific parameters', () => {
        const customParams = {
          element: `#${DEFAULT_ELEMENT_ID}`,
          view: {
            type: 'constellation' as const,
            parameters: {
              constellation: 'TAU' // Taurus
            }
          }
        };
        astronomyAPI.starChart(customParams);
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.view.type).toBe('constellation');
        expect(fetchCallBody.view.parameters.constellation).toBe('TAU');
      });


      it('should log error if target element is not found', () => {
        astronomyAPI.starChart({ element: '#non-existent-element-sc' });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Target element '#non-existent-element-sc' not found")
        );
      });
      
      it('should warn and default for invalid observer.longitude', async () => { 
        astronomyAPI.starChart({ element: `#${DEFAULT_ELEMENT_ID}`, observer: { longitude: 200 }});
        await Promise.resolve(); // Wait for microtasks / JSDOM updates for consoleWarn
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid observer.longitude ('200')")
        );
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.observer.longitude).toBe(0); // Default longitude
      });

      it('should warn and default for invalid view.type', async () => { 
        astronomyAPI.starChart({ element: `#${DEFAULT_ELEMENT_ID}`, view: { type: 'invalid-view' }});
        await Promise.resolve(); // Wait for microtasks / JSDOM updates for consoleWarn
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid view.type ('invalid-view')")
        );
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.view.type).toBe('area'); // Default view.type for starChart
      });

      it('should warn and default for view.type constellation with invalid constellation code', async () => { 
        astronomyAPI.starChart({ element: `#${DEFAULT_ELEMENT_ID}`, view: { type: 'constellation', parameters: { constellation: 'INVALID' }}});
        await Promise.resolve(); // Wait for microtasks / JSDOM updates for consoleWarn
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          // The message comes from validateConstellationCode helper
          expect.stringContaining("AstronomyAPI (starChart): Invalid view.parameters.constellation ('INVALID') provided. Must be a 3-letter IAU constellation code. Defaulting to 'ORI'.")
        );
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.view.parameters.constellation).toBe('ORI'); 
      });
      
      it('should default to "ORI" if view.type is constellation and no code provided', async () => { 
        astronomyAPI.starChart({ element: `#${DEFAULT_ELEMENT_ID}`, view: { type: 'constellation' }});
        await Promise.resolve(); // Wait for microtasks / JSDOM updates for consoleWarn
         expect(consoleWarnSpy).toHaveBeenCalledWith(
          // This message comes from the starChart method itself
          expect.stringContaining("AstronomyAPI (starChart): view.type is 'constellation' but no 'view.parameters.constellation' string was provided. Defaulting to 'ORI'.")
        );
        const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchCallBody.view.parameters.constellation).toBe('ORI');
      });

      // Error handling tests for starChart (can be brief as request method is shared)
      it('should display "Loading..." then error message on 422 API error for starChart', async () => {
        let resolveFetch: (value: any) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveFetch = r; }));

        astronomyAPI.starChart({ element: `#${DEFAULT_ELEMENT_ID}` });

        await Promise.resolve();
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Loading...');
        
        resolveFetch!({
            ok: false, status: 422, json: () => Promise.resolve({ error: 'SC Invalid params' }), text: () => Promise.resolve(JSON.stringify({ error: 'SC Invalid params' }))
        });

        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        
        expect(widgetContainer.querySelector('p')?.innerText).toBe('Invalid parameters sent to API');
      });
    });
  });
});
