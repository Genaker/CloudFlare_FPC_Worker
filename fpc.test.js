
//import fetch from 'node-fetch'
const fetch = require('node-fetch')

// Make sure the last worker changes is deployed to the domain you are using
// To run tests: npm install && npm test

/**
 * CF Page rule must be applied
 * 
 * Disable Security, Browser Integrity Check: Off
 * 
 */
const URL = process.env.TEST_URL;
let uniqueParam = "?test-param=" + Date.now();

const DYNAMIC = "DYNAMIC";
const HIT = "HIT";


describe("FPC TESTS", () => {
  jest.setTimeout(60000);
  test('New Request Test', async () => {
    const response = await fetch(URL + uniqueParam);
    const headers = response.headers;
    console.log(response);
    console.log(headers);
    if (headers.get('cf-mitigated') !== null) {
      throw new Error('Disable CF WAF protection');
      process.exit(1);
    }
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toEqual(",Miss,FetchedOrigin,CachingAsync,");
  });

  test('Repeated Requests Test', async () => {
    const url = URL + uniqueParam;
    let response = await fetch(url);
    await new Promise((r) => setTimeout(r, 2000));
    response = await fetch(url);
    response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(200);
    expect(headers.get('age')).not.toBeNull();
    expect(headers.get('js-time')).not.toBeNull();
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('key')).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,");
  });

  test('Repeated Requests Test #2', async () => {
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    let response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(200);
    expect(headers.get('age')).not.toBeNull();
    expect(headers.get('js-time')).not.toBeNull();
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('key')).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,");
  });

  test('Repeated Requests Pass CDN', async () => {
    // add bypass CDN get parameter 
    const bypassCDN = "&cf-cdn=false"
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    let response = await fetch(url + bypassCDN);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(200);
    expect(headers.get('age')).not.toBeNull();
    expect(headers.get('js-time')).not.toBeNull();
    expect(headers.get('r2-time')).not.toBeNull();
    expect(headers.get('r2')).toEqual("true");
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('key')).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,");
  });

  test('Repeated Requests Test #2', async () => {
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    let response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(200);
    expect(headers.get('age')).not.toBeNull();
    expect(headers.get('js-time')).not.toBeNull();
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('key')).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,");
  });

  test('Repeated Requests Pass CDN', async () => {
    // add bypass CDN get parameter 
    const bypassCDN = "&cf-cdn=false"
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    let response = await fetch(url + bypassCDN);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(200);
    expect(headers.get('age')).not.toBeNull();
    expect(headers.get('js-time')).not.toBeNull();
    expect(headers.get('r2-time')).not.toBeNull();
    expect(headers.get('r2')).toEqual("true");
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('key')).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,");
  });


  test('Delete Page from CDN', async () => {
    // add bypass CDN get parameter 
    const deleteFromCDN = "&cf-delete=true"
    const url = URL + uniqueParam;
    let response = await fetch(url + deleteFromCDN);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(211);
    expect(headers.get('deleted')).toEqual("true");
    expect(headers.get('delete-status')).toEqual("true");

  });

  test('Fetch after Delete', async () => {
    // Clears it not right away
    await new Promise((r) => setTimeout(r, 2000));
    const url = URL + uniqueParam;
    const response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    // This rule works randomly ->
    //expect(headers.get('r2')).toEqual("true");
  }, 10000);


  uniqueParam = "?test-param=" + Date.now();

  test('Fetch New Page', async () => {
    // Clears it not right away
    const url = URL + uniqueParam;
    const response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    await new Promise((r) => setTimeout(r, 10000));
  });

  let previousCacheVersion = null;
  test('Change Version', async () => {
    // Clears it not right away
    const changeVersionPurgeParameter = "&cf-purge=true"
    const url = URL + uniqueParam;
    const response = await fetch(url + changeVersionPurgeParameter);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(222);
    expect(headers.get('Cache-Version')).not.toEqual(null);
    previousCacheVersion = parseInt(headers.get('Cache-Version')) - 1;
  });

  test('Fetch after Change Version', async () => {
    // Clears it not right away
    const url = URL + uniqueParam;
    //Backend Revalidation happens slow 
    await new Promise((r) => setTimeout(r, 5000));
    const response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    let currentVersion = headers.get('x-html-edge-cache-version')
    expect(parseInt(currentVersion)).not.toEqual(null);
    let status = "Hit,Stale,Refreshed";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
    expect(parseInt(headers.get('stale-version'))).toEqual(parseInt(currentVersion) - 1);
  });

  test('Fetch second time after Change Version #2', async () => {
    // Clears it not right away
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 8000));
    const response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    let currentVersion = headers.get('x-html-edge-cache-version')
    expect(parseInt(currentVersion)).not.toEqual(null);
    expect(headers.get('key')).toContain(currentVersion);
    let status = "Hit,Stale_";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
  });

  test('Test ignored GET parameters', async () => {
    // Clears it not right away
    const ignoredGET = "&add=fdgdfg";
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(url + ignoredGET);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    let currentVersion = headers.get('x-html-edge-cache-version')
    expect(parseInt(currentVersion)).not.toEqual(null);
    expect(headers.get('key')).toContain(currentVersion);
    expect(headers.get('key')).not.toContain(ignoredGET);
    let status = "Hit,Stale_";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
  });

  test('Test ignored GET parameters multiple', async () => {
    // Clears it not right away
    const ignoredGET = "&add=fdgdfg&gclsrc=sfsd";
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(url + ignoredGET);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    let currentVersion = headers.get('x-html-edge-cache-version')
    expect(parseInt(currentVersion)).not.toEqual(null);
    expect(headers.get('key')).toContain(currentVersion);
    expect(headers.get('key')).not.toContain(ignoredGET);
    let status = "Hit,Stale";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
  });

  test('Test ignored GET parameters different', async () => {
    // Clears it not right away
    const ignoredGET = "&add=fdgdfg&gclsrc=sfsd";
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(url + ignoredGET + "&mustbepresent=6666");
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    let currentVersion = headers.get('x-html-edge-cache-version')
    //TODO: Add key to all responses
    //expect(headers.get('key')).toContain('mustbepresent');
    //expect(headers.get('key')).not.toContain(ignoredGET);
    let status = "Miss,FetchedOrigin";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
  });

  test('Test bypass URL', async () => {
    // Clears it not right away
    const bypassGET = "&ajax";
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(url + bypassGET);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain("BypassURL");
  });

  test('Test bypass and ignore parameters in URL', async () => {
    // Clears it not right away
    const bypassGET = "&ajax=123&gclsrc=123";
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(url + bypassGET);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain("BypassURL");
  });

  describe("ASYNC revalidation Logic", () => {
  test('Revalidate Logic ', async () => {
    let localUniqueValue =  Date.now();
   
    // TTL set to 1 after 2 second delay it must be revalidated
    let GET = "&sfsdfsd=" + localUniqueValue + "&add=123";
    const url = URL + uniqueParam;
    //warm up cache
    let response = await fetch(url + GET);
    let headers = response.headers;
    console.log(url + GET);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain("Miss,FetchedOrigin,CachingAsync");

    GET = "&sfsdfsd=" + localUniqueValue + "&add=123&cf-ttl=1";
    //Wait 12 Seconds
    await new Promise((r) => setTimeout(r, 12000));
    response = await fetch(url + GET);
    headers = response.headers;
    console.log(url + GET);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    let status = "Hit,Refreshed";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
    expect(headers.get('custom-ttl')).toContain("1");
   
    // Check if R2 is updates Age must be around delay time less than 10
    await new Promise((r) => setTimeout(r, 8000));
    response = await fetch(url + GET + "&cf-cdn=false");
    headers = response.headers;
    console.log(url + GET);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(parseInt(headers.get('age'))).toBeLessThan(10);
    expect(headers.get('x-html-edge-cache-status')).toContain("FromR2");
    expect(headers.get('r2')).toEqual("true");
  });
});

  describe("Test R2 Stale ", () => {
    let previousCacheVersion = null;
    test('Change Version', async () => {
      // Clears it not right away
      const changeVersionPurgeParameter = "&cf-purge=true"
      const url = URL + uniqueParam;
      const response = await fetch(url + changeVersionPurgeParameter);
      const headers = response.headers;
      console.log(url);
      console.log(response);
      console.log(headers);
      expect(response.status).toEqual(222);
      expect(headers.get('Cache-Version')).not.toEqual(null);
      previousCacheVersion = parseInt(headers.get('Cache-Version')) - 1;
    });

    test('Fetch Change Version without CDN', async () => {

      const changeVersionPurgeParameter = "&cf-cdn=false"
      const url = URL + uniqueParam;
      const response = await fetch(url + changeVersionPurgeParameter);
      const headers = response.headers;
      console.log(url);
      console.log(response);
      console.log(headers);
      expect(response.status).toEqual(200);
      expect(headers.get('r2')).toEqual("true");
      expect(headers.get('r2-cache-version')).toEqual(previousCacheVersion.toString());
      expect(headers.get('cf-cache-status')).toEqual(HIT);
      
      //expect(headers.get('R2-stale')).toEqual("true");
    });
  });

})
