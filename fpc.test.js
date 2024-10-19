
// To run the tests set: export TEST_URL="http://site.com/" and run: npm test
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

const DYNAMIC = "DYNAMIC";
const HIT = "HIT";

jest.setTimeout(60000);

let beforeTestVersion = null;
let preheatedUrl = null;

describe("FPC TESTS", () => {
  let uniqueParam = "?test-param=" + Date.now();

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
    expect(headers.get('x-html-edge-cache-version')).not.toEqual(null);
    beforeTestVersion = headers.get('x-html-edge-cache-version');
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain(",Miss,FetchedOrigin,CachingAsync,");
  });

  test('Repeated Requests Test', async () => {
    const url = URL + uniqueParam;
    let response = await fetch(url);
    await new Promise((r) => setTimeout(r, 1000));
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

  test('Repeated Requests Test #3', async () => {
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
    console.log(url  + deleteFromCDN);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(211);
    expect(headers.get('deleted')).toEqual("true");
    expect(headers.get('delete-status')).toEqual("true");

  });

  test('Fetch after Delete', async () => {
    // CF Clears it not right away
    await new Promise((r) => setTimeout(r, 5000));
    const url = URL + uniqueParam;
    const response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    // ToDO: This rule works randomly ->
    // expect(headers.get('r2')).toEqual("true");
  });

 

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
    await new Promise((r) => setTimeout(r, 1000));
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

  // Randomly fails. It is ok. 
  test('Fetch second time after Change Version #2', async () => {
    // Clears it not right away
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 10000));
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



})


describe("ASYNC revalidation Logic", () => {
  let localUniqueValue = Date.now();
  // TTL set to 1 after 2 second delay it must be revalidated
  let GET = "&sfsdfsd=" + localUniqueValue + "&add=123";
  let uniqueParam = "?test-param=" + Date.now();
  let url = URL + uniqueParam;

  test('Pre Fetch', async () => {
    //warm up cache
    let response = await fetch(url + GET);
    preheatedUrl = url + GET;
    let headers = response.headers;
    console.log(url + GET);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain("Miss,FetchedOrigin,CachingAsync");
  });
  test("Fetch with expired AGE", async () => {
    GET = "&sfsdfsd=" + localUniqueValue + "&add=123&cf-ttl=1";
    //Wait 12 Seconds
    await new Promise((r) => setTimeout(r, 5000));
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
  });
  test("Fetch Without CDN ", async () => {
    // Check if R2 is updates Age must be around delay time less than 10
    await new Promise((r) => setTimeout(r, 6000));
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

describe("Test R2 Stale", () => {
  let uniqueParam = "?test-params=" + Date.now() + "&sdfsdf=sfsdf";
  let previousCacheVersion = null;

  test('Pre Fetch', async () => {
    // Clears it not right away
    const url = URL + uniqueParam;
    const response = await fetch(url);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('x-html-edge-cache-status')).toContain("Miss,FetchedOrigin,CachingAsync");
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
  });

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
    expect(headers.get('Cache-Version')).toEqual((previousCacheVersion + 1).toString());
  });

  test('Fetch Changed Version without CDN', async () => {
    const cdnMissParameter = "&cf-cdn=false"
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(url + cdnMissParameter);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('r2')).toEqual("true");
    expect(headers.get('r2-cache-version')).toEqual(previousCacheVersion.toString());
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('stale-version')).toEqual(previousCacheVersion.toString());
    expect(headers.get('r2-stale')).toEqual("true");
    expect(headers.get('key')).toContain((previousCacheVersion + 1).toString());
    expect(headers.get('r2-stale-url')).toContain((previousCacheVersion).toString());
    expect(headers.get('x-html-edge-cache-version')).toContain((previousCacheVersion + 1).toString());

    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,Stale,Refreshed");
    expect(headers.get('x-html-edge-cache-status')).toContain("FromR2,R2Stale");
  });

  test('Fetch Changed Version without CDN #2 revalidated', async () => {
    const changeVersionPurgeParameter = "&cf-cdn=false"
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 6000));
    const response = await fetch(url + changeVersionPurgeParameter);
    const headers = response.headers;
    console.log(url);

    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    expect(headers.get('r2')).toEqual("true");
    expect(headers.get('r2-cache-version')).toEqual((previousCacheVersion + 1).toString());
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('x-html-edge-cache-status')).toContain("FromR2");
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit");
    expect(headers.get('x-html-edge-cache-status')).toContain("SavedCDNasync");
  });
});

describe("Restore CF Version", () => {
// restore version
  test("Set Version Back", async () => {
  const restoreVersionURL = URL + "?cf-version=" + beforeTestVersion;
  let response = await fetch(URL + restoreVersionURL);
  expect(response.status).toEqual(223);
  expect(response.headers.get('cache-version')).toContain(beforeTestVersion);
  });

  test("Check Version", async () => {
  response = await fetch(URL + "?dfghgdfhgfh=" + Date.now());
  expect(response.headers.get('x-html-edge-cache-version')).toEqual(beforeTestVersion);
  })
})


describe("Speculation Rules Test", () => {
  // restore version
    test("Check no return if not cached", async () => {
    let testHeaders = {'Sec-Purpose' : "prerender"};
    const url = URL + "?sdsd=" + Date.now();
    let response = await fetch(url, {headers: testHeaders});
    expect(response.status).toEqual(406);
    });

    test("Check if not cache response is not cached", async () => {
      let testHeaders = {'Sec-Purpose' : "prerender"};
      const url = URL + "?sdsd=" + Date.now();
      let response = await fetch(url);
      expect(response.status).toEqual(200);
      });
  
    test("Check if cached", async () => {
    response = await fetch(preheatedUrl);
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(response.headers.get('x-html-edge-cache-version')).toEqual(beforeTestVersion);
    })
  })

describe("GOOD_MOD tests", () => {
    test('Pre Fetch Url', () => {});
})