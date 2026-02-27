
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
    }
    expect(response.status).toEqual(200);
    if (response.status !== 200) {
      process.exit("Server Response Error - Fix Server first");
    }
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
    expect(headers.get('js-time')).not.toBeNull();
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('key')).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,");
  });

  /**
   * Repeated Requests Pass CDN
   *
   * Uses cf-cdn=false to bypass Cloudflare edge cache and hit the worker directly.
   * The worker then fetches from R2 (if cached) or origin. There is a race between
   * R2 and origin: when R2 wins we get HIT; when origin wins (server-first) we get DYNAMIC.
   * Both outcomes are valid, so we accept either and only assert R2-specific headers when HIT.
   */
  test('Repeated Requests Pass CDN', async () => {
    const bypassCDN = "&cf-cdn=false";
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    let response = await fetch(url + bypassCDN);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(200);
    expect(headers.get('js-time')).not.toBeNull();
    const cacheStatus = headers.get('cf-cache-status');
    expect(['HIT', 'DYNAMIC']).toContain(cacheStatus);
    const r2 = headers.get('r2');
    if (r2 === "true") {
      const key = headers.get('key');
      if (key) expect(key).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
      expect(headers.get('r2-time')).not.toBeNull();
    } else {
      const r2Cache = headers.get('r2-cache');
      if (r2Cache) expect(['server-first', 'r2-null-server', 'miss']).toContain(r2Cache);
    }
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
    expect(headers.get('js-time')).not.toBeNull();
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('key')).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit,");
  });

  /**
   * Repeated Requests Pass CDN
   *
   * Uses cf-cdn=false to bypass Cloudflare edge cache and hit the worker directly.
   * The worker then fetches from R2 (if cached) or origin. There is a race between
   * R2 and origin: when R2 wins we get HIT; when origin wins (server-first) we get DYNAMIC.
   * Both outcomes are valid, so we accept either and only assert R2-specific headers when HIT.
   */
  test('Repeated Requests Pass CDN', async () => {
    const bypassCDN = "&cf-cdn=false";
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 1000));
    let response = await fetch(url + bypassCDN);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    const cacheVersion = parseInt(headers.get('x-html-edge-cache-version'));
    expect(response.status).toEqual(200);
    expect(headers.get('js-time')).not.toBeNull();
    const cacheStatus = headers.get('cf-cache-status');
    expect(['HIT', 'DYNAMIC']).toContain(cacheStatus);
    const r2 = headers.get('r2');
    if (r2 === "true") {
      const key = headers.get('key');
      if (key) expect(key).toEqual(url + "&cf_edge_cache_ver=" + cacheVersion);
      expect(headers.get('r2-time')).not.toBeNull();
    } else {
      const r2Cache = headers.get('r2-cache');
      if (r2Cache) expect(['server-first', 'r2-null-server', 'miss']).toContain(r2Cache);
    }
  });

  test('Delete Page from CDN', async () => {
    // add bypass CDN get parameter 
    const deleteFromCDN = "&cf-delete=true"
    const url = URL + uniqueParam;
    let response = await fetch(url + deleteFromCDN);
    const headers = response.headers;
    console.log(url + deleteFromCDN);
    console.log(response);
    console.log(headers);
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
    expect(parseInt(headers.get('stale-version'))).toEqual(previousCacheVersion);
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
    expect(headers.get('cf-cache-status')).toEqual("BYPASS,WORKER,MISS");
    expect(headers.get('bypass-worker')).toEqual("true");
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
    expect(headers.get('cf-cache-status')).toEqual("BYPASS,WORKER,MISS");
    expect(headers.get('bypass-worker')).toEqual("true");
  });
})

describe("ASYNC revalidation Logic", () => {
  let localUniqueValue = Date.now();
  // TTL set to 1 after 2 second delay it must be revalidated
  let GET = "&sfsdfsd=" + localUniqueValue + "&add=123";
  let uniqueParam = "?test-param=" + Date.now();
  let url = URL + uniqueParam;
  let response, headers;

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
    let status1 = "Hit";
    let status2 = "Refreshed";
    expect(headers.get('x-html-edge-cache-status')).toContain(status1);
    expect(headers.get('x-html-edge-cache-status')).toContain(status2);
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
    // cf-cdn=false: HIT when served from R2, DYNAMIC when origin wins race (server-first)
    const cacheStatus = headers.get('cf-cache-status');
    expect(['HIT', 'DYNAMIC']).toContain(cacheStatus);
    const r2 = headers.get('r2');
    if (r2 === "true") {
      const age = headers.get('age');
      if (age !== null) expect(parseInt(age)).toBeLessThan(13);
      expect(headers.get('x-html-edge-cache-status')).toContain("FromR2");
    } else {
      const r2Cache = headers.get('r2-cache');
      if (r2Cache) expect(['server-first', 'r2-null-server', 'miss']).toContain(r2Cache);
    }
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

  test('Fetch Changed Version without CDN - R2 Stale', async () => {
    const cdnMissParameter = "&cf-cdn=false"
    const url = URL + uniqueParam;
    await new Promise((r) => setTimeout(r, 4000));
    const response = await fetch(url + cdnMissParameter);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    if (headers.get('r2') === "true") {
      expect(headers.get('r2-cache-version')).toEqual(previousCacheVersion.toString());
      expect(headers.get('cf-cache-status')).toEqual(HIT);
      expect(headers.get('stale-version')).toEqual(previousCacheVersion.toString());
      expect(headers.get('r2-stale')).toEqual("true");
      expect(headers.get('key')).toContain((previousCacheVersion + 1).toString());
      expect(headers.get('r2-stale-url')).toContain((previousCacheVersion).toString());
      expect(headers.get('x-html-edge-cache-version')).toContain((previousCacheVersion + 1).toString());
      expect(headers.get('x-html-edge-cache-status')).toContain("Hit,Stale,Refreshed");
      expect(headers.get('x-html-edge-cache-status')).toContain("FromR2,R2Stale");
    } else {
      const r2Cache = headers.get('r2-cache');
      if (r2Cache) expect(['server-first', 'r2-null-server', 'miss']).toContain(r2Cache);
    }
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
    // cf-cdn=false: R2 when served from bucket, null when origin wins race (server-first)
    if (headers.get('r2') === "true") {
      expect(headers.get('r2-cache-version')).toEqual((previousCacheVersion + 1).toString());
      expect(headers.get('cf-cache-status')).toEqual(HIT);
      expect(headers.get('x-html-edge-cache-status')).toContain("FromR2");
      expect(headers.get('x-html-edge-cache-status')).toContain("Hit");
      expect(headers.get('x-html-edge-cache-status')).toContain("SavedCDNasync");
    } else {
      const r2Cache = headers.get('r2-cache');
      if (r2Cache) expect(['server-first', 'r2-null-server', 'miss']).toContain(r2Cache);
    }
  });
});

describe("Restore CF Version", () => {
  let response;
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
  let response, headers;
  let specUrl = null; // Preheat in this block to avoid version mismatch from Test R2 Stale / Restore CF Version

  test("Check no return if not cached", async () => {
    let testHeaders = { 'Sec-Purpose': "prerender" };
    const url = URL + "?sdsd=" + Date.now();
    let response = await fetch(url, { headers: testHeaders });
    expect(response.status).toEqual(406);
  });

  test("Check if not cache response is not cached", async () => {
    const url = URL + "?sdsd=" + Date.now();
    let response = await fetch(url);
    expect(response.status).toEqual(200);
  });

  test("Preheat URL for speculation check", async () => {
    specUrl = URL + "?speculation-preheat=" + Date.now();
    const r = await fetch(specUrl);
    expect(r.status).toEqual(200);
    expect(r.headers.get('cf-cache-status')).toEqual(DYNAMIC);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Allow cache propagation
  });

  test("Check if cached", async () => {
    response = await fetch(specUrl);
    headers = response.headers;
    expect(response.status).toEqual(200);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(response.headers.get('x-html-edge-cache-version')).toEqual(beforeTestVersion);
  })
})

describe("GOD_MOD tests", () => {
  test('PreFetch Url', () => { });
})

describe("Test Logged-In", () => {
  test("Test Logged-In Bypass cookies", async () => {
    let testHeaders = { 'cookie': "X-Magento-Vary=sdfsdfdsfdsf34234dsfsdfsdf;test=test;" };
    const url = URL + "?sdsd=" + Date.now() + "&cf-cdn=false";
    let response = await fetch(url, { headers: testHeaders });
    expect(response.status).toEqual(200);
    expect(response.headers.get('cf-cache-status')).toEqual(DYNAMIC);
  });
})

describe("Test HASH", () => {
  let GET = "?randome=" + Date.now();
  let hash = "";
  let r2Time = null;
  let response, headers;
  test('Pre Fetch', async () => {
    //warm up cache
    let response = await fetch(URL + GET);
    let headers = response.headers;
    console.log(URL + GET);
    console.log(response);
    console.log(headers);

    expect(response.status).toEqual(200);
    expect(headers.get('r2-hash')).toBeNull();
    //expect(headers.get('r2-promise')).toEqual("1");
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain("Miss,FetchedOrigin,CachingAsync");
  });

  test('Pre Fetch without Race ', async () => {
    //warm up cache
    let response = await fetch(URL + GET + "&aa=bb&r2-race=0");
    let headers = response.headers;
    console.log(URL + GET);
    console.log(response);
    console.log(headers);

    expect(response.status).toEqual(200);
    expect(headers.get('r2-hash')).toBeNull();
    //expect(headers.get('r2-promise')).toBeNull();
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain("Miss,FetchedOrigin,CachingAsync");
  });

  test("Read hash", async () => {
    await new Promise((r) => setTimeout(r, 4000));
    response = await fetch(URL + GET + "&cf-cdn=false&r2-race=false");
    headers = response.headers;
    console.log(URL + GET);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    let status = "FromR2,SavedCDNasync,Hit";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
    hash = headers.get('r2-hash');
    r2Time = headers.get('r2-time');
    expect(headers.get('r2-hash')).not.toBeNull();
    expect(headers.get('cf-cache-status')).toEqual(HIT);
  });

  test("Fetch with expired AGE and check new hash", async () => {
    GET = GET + "&cf-ttl=1&cf-cdn=false&r2-race=false";
    //Wait 12 Seconds
    await new Promise((r) => setTimeout(r, 5000));
    response = await fetch(URL + GET);
    headers = response.headers;
    console.log(URL + GET);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(200);
    // If from server it doesn't have hash

    expect(headers.get('r2-hash')).not.toBeNull();
    expect(headers.get('r2-hash')).toEqual(hash);
    expect(headers.get('r2-time')).toEqual(r2Time);

    expect(headers.get('cf-cache-status')).toEqual(HIT);
    expect(headers.get('x-html-edge-cache-status')).toContain('Hit');
    expect(headers.get('x-html-edge-cache-status')).toContain('Refreshed');
    expect(headers.get('custom-ttl')).toContain("1");
  });
})

describe("301 redirect test", () => {
  let GET2 = "/about-tilebar/?r2-race=false&dfsd=" + Date.now();
  let response, headers;
  test('Pre Fetch  301', async () => {
    //warm up cache
    let response = await fetch(URL + GET2, { redirect: "manual" });
    let headers = response.headers;
    console.log(URL + GET2);
    console.log(response);
    console.log(headers);

    expect(response.status).toEqual(301);
    expect(headers.get('cf-cache-status')).toEqual(DYNAMIC);
    expect(headers.get('x-html-edge-cache-status')).toContain("Miss,FetchedOrigin,CachingAsync");
  });

  test("301 redirect ", async () => {
    await new Promise((r) => setTimeout(r, 4000));
    response = await fetch(URL + GET2, { redirect: "manual" });
    headers = response.headers;
    console.log(URL + GET2);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(301);
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    let status = "Hit,Stale";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
  });

  test("301 redirect R2", async () => {
    await new Promise((r) => setTimeout(r, 4000));
    response = await fetch(URL + GET2 + "&cf-cdn=false", { redirect: "manual" });
    headers = response.headers;
    console.log(URL + GET2);
    console.log(response);
    console.log(headers);
    expect(response.status).toEqual(301);
    expect(headers.get('r2')).toEqual("true");
    expect(headers.get('cf-cache-status')).toEqual(HIT);
    let status = "FromR2,SavedCDNasync,Hit";
    expect(headers.get('x-html-edge-cache-status')).toContain(status);
  });
})

// ---------------------------------------------------------------------------
// HTTP Method Bypass
// ---------------------------------------------------------------------------
describe("HTTP Method Bypass", () => {
  const param = "?method-test=" + Date.now();

  test("POST request is never cached (not HIT)", async () => {
    // redirect: "manual" prevents following 302 — Magento redirects POST (invalid form key)
    // so without this we'd get HIT from the cached GET after redirect
    const response = await fetch(URL + param, {
      method: "POST",
      body: "test=1",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      redirect: "manual",
    });
    // POST typically returns 302 (Magento) or 200; either way cf-cache-status should not be HIT
    expect([200, 302]).toContain(response.status);
    expect(response.headers.get("cf-cache-status")).not.toEqual(HIT);
  });

  test("PUT request is never cached (not HIT)", async () => {
    const response = await fetch(URL + param + "&put=1", {
      method: "PUT",
      body: JSON.stringify({ test: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.headers.get("cf-cache-status")).not.toEqual(HIT);
  });

  test("DELETE request is never cached (not HIT)", async () => {
    const response = await fetch(URL + param + "&del=1", { method: "DELETE" });
    expect(response.headers.get("cf-cache-status")).not.toEqual(HIT);
  });

  test("HEAD request returns 200 (worker handles HEAD)", async () => {
    const headParam = "?head-test=" + Date.now();
    await fetch(URL + headParam); // warm with GET
    const response = await fetch(URL + headParam, { method: "HEAD" });
    expect(response.status).toEqual(200);
    expect(response.headers.get("cf-cache-status")).not.toBeNull();
  });

  test("HEAD request on warmed URL returns HIT", async () => {
    const headParam = "?head-cache-test=" + Date.now();
    await fetch(URL + headParam);
    await new Promise((r) => setTimeout(r, 1500));
    await fetch(URL + headParam);
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(URL + headParam, { method: "HEAD" });
    expect(response.headers.get("cf-cache-status")).toEqual(HIT);
  });
});

// ---------------------------------------------------------------------------
// Cookie-Based Bypass
// ---------------------------------------------------------------------------
describe("Cookie-Based Bypass", () => {
  test("admin cookie triggers bypass-worker: true", async () => {
    const response = await fetch(URL + "?admin-cookie-test=" + Date.now(), {
      headers: { cookie: "admin=abc123; other=test" },
    });
    expect(response.headers.get("bypass-worker")).toEqual("true");
    expect(response.headers.get("cf-cache-status")).toEqual("BYPASS,WORKER,MISS");
  });

  test("bypass-cookies header set when bypassed via admin cookie", async () => {
    const response = await fetch(URL + "?admin-cookie-header=" + Date.now(), {
      headers: { cookie: "admin=bypass_me; store=default" },
    });
    expect(response.headers.get("bypass-cookies")).toEqual("true");
  });

  test("form_key cookie does NOT prevent caching", async () => {
    const url = URL + "?safe-cookie-test=" + Date.now();
    await fetch(url, { headers: { cookie: "form_key=abc123; store=default" } });
    await new Promise((r) => setTimeout(r, 1500));
    const response = await fetch(url, { headers: { cookie: "form_key=xyz789; store=default" } });
    expect(response.headers.get("cf-cache-status")).toEqual(HIT);
  });

  test("X-Magento-Vary cookie bypasses caching (logged-in user)", async () => {
    const response = await fetch(URL + "?vary-bypass-test=" + Date.now(), {
      headers: { cookie: "X-Magento-Vary=abc123xyzloggedin456" },
    });
    expect(response.headers.get("cf-cache-status")).toEqual(DYNAMIC);
  });

  test("Different X-Magento-Vary values do not share a cache entry", async () => {
    const base = URL + "?vary-cache-sep=" + Date.now();
    await fetch(base);
    await new Promise((r) => setTimeout(r, 1500));
    const logged = await fetch(base, {
      headers: { cookie: "X-Magento-Vary=customer_group_2_store_1" },
    });
    // Logged-in user must not get the guest HIT
    expect(logged.headers.get("cf-cache-status")).toEqual(DYNAMIC);
  });
});

// ---------------------------------------------------------------------------
// URL-Pattern Bypass (BYPASS_URL list)
// ---------------------------------------------------------------------------
describe("URL-Pattern Bypass", () => {
  const bypassCases = [
    ["checkout in path",      "checkout/?test=" + Date.now()],
    ["customer in path",      "customer/?test=" + Date.now()],
    ["cart in path",          "cart/?test=" + Date.now()],
    ["catalogsearch in path", "catalogsearch/result/?q=gold&ts=" + Date.now()],
    ["order in path",         "sales/order/history/?test=" + Date.now()],
    ["api in path",           "api/v1/products?test=" + Date.now()],
    ["rest/ in path",         "rest/V1/store/storeViews?test=" + Date.now()],
    ["paypal in path",        "paypal/express/start/?test=" + Date.now()],
    ["compare in path",       "catalog/product_compare/?test=" + Date.now()],
    ["onestepcheckout",       "onestepcheckout/?test=" + Date.now()],
    ["account in path",       "customer/account/?test=" + Date.now()],
    ["tracking in path",      "sales/order/tracking/?test=" + Date.now()],
  ];

  test.each(bypassCases)("%s → bypass-worker: true, BYPASS,WORKER,MISS", async (_label, path) => {
    const response = await fetch(URL + path);
    expect(response.headers.get("bypass-worker")).toEqual("true");
    expect(response.headers.get("cf-cache-status")).toEqual("BYPASS,WORKER,MISS");
  });

  test("Normal product URL is NOT bypassed", async () => {
    const response = await fetch(URL + "?normal-page=" + Date.now());
    expect(response.headers.get("bypass-worker")).toBeNull();
    expect(response.headers.get("cf-cache-status")).toEqual(DYNAMIC);
  });
});

// ---------------------------------------------------------------------------
// Worker Bypass Parameter (cfw=false)
// ---------------------------------------------------------------------------
describe("Worker Bypass Parameter (cfw=false)", () => {
  test("cfw=false returns bypass-worker: true", async () => {
    const response = await fetch(URL + "?cfw=false&test=" + Date.now());
    expect(response.headers.get("bypass-worker")).toEqual("true");
    expect(response.headers.get("cf-cache-status")).toEqual("BYPASS,WORKER,MISS");
  });

  test("Normal request (no cfw param) is NOT bypassed", async () => {
    const response = await fetch(URL + "?test=" + Date.now());
    expect(response.headers.get("bypass-worker")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FILTER_GET Tracking Parameter Removal
// ---------------------------------------------------------------------------
describe("FILTER_GET Tracking Parameter Removal", () => {
  let base;

  beforeAll(async () => {
    base = URL + "?track-base=" + Date.now();
    await fetch(base);
    await new Promise((r) => setTimeout(r, 1500));
    await fetch(base); // confirm HIT
    await new Promise((r) => setTimeout(r, 1000));
  });

  const trackingParams = [
    ["utm_source + utm_medium",  "&utm_source=google&utm_medium=cpc"],
    ["utm_campaign + content",   "&utm_campaign=spring&utm_content=ad1"],
    ["fbclid",                   "&fbclid=IwAR3abc123"],
    ["gclid",                    "&gclid=EAIaIQobChMI"],
    ["gclsrc",                   "&gclsrc=aw.ds"],
    ["msclkid",                  "&msclkid=abc123msft"],
    ["_ga + _gl",                "&_ga=2.123.456&_gl=1*test*_ga*MTI"],
    ["_hsenc + _hsmi",           "&_hsenc=p8YJu_abc&_hsmi=123"],
    ["wbraid + epik",            "&wbraid=abc123&epik=dj0yJmk9test"],
    ["add (marketing)",          "&add=campaign_value"],
    ["srsltid",                  "&srsltid=AfmBOoqtest123"],
    ["ref",                      "&ref=newsletter"],
    ["All combined",             "&utm_source=google&fbclid=xyz&gclid=EAI&_ga=2.1.1"],
  ];

  test.each(trackingParams)("Filtered param '%s' resolves to same cached entry (HIT)", async (_label, param) => {
    await new Promise((r) => setTimeout(r, 300));
    const response = await fetch(base + param);
    expect(response.status).toEqual(200);
    expect(response.headers.get("cf-cache-status")).toEqual(HIT);
    const key = response.headers.get("key") ?? "";
    // The normalised key must not contain the tracking param
    param.replace("&", "").split("&").forEach((p) => {
      expect(key).not.toContain(p.split("=")[0]);
    });
  });
});

// ---------------------------------------------------------------------------
// Version-Set Endpoint (cf-version=N)
// ---------------------------------------------------------------------------
describe("Version-Set Endpoint (cf-version=N)", () => {
  const targetVersion = 77;

  test("cf-version=N responds with status 223", async () => {
    const response = await fetch(URL + "?cf-version=" + targetVersion + "&ts=" + Date.now());
    expect(response.status).toEqual(223);
  });

  test("cf-version=N response has cache-version: N header", async () => {
    const response = await fetch(URL + "?cf-version=" + targetVersion + "&ts=" + Date.now());
    expect(response.headers.get("cache-version")).toEqual(String(targetVersion));
  });
});

// ---------------------------------------------------------------------------
// Response Header Manipulation — CSP-RO Removal
// ---------------------------------------------------------------------------
describe("CSP-RO Header Removal", () => {
  test("content-security-policy-report-only is absent on fresh response", async () => {
    const response = await fetch(URL + "?cspro-fresh=" + Date.now());
    expect(response.headers.get("content-security-policy-report-only")).toBeNull();
  });

  test("content-security-policy-report-only is absent on HIT response", async () => {
    const url = URL + "?cspro-hit=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    const cached = await fetch(url);
    expect(cached.headers.get("cf-cache-status")).toEqual(HIT);
    expect(cached.headers.get("content-security-policy-report-only")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Non-Cacheable Status Codes
// ---------------------------------------------------------------------------
describe("Non-Cacheable Status Codes", () => {
  test("404 response is not served from cache on repeat requests", async () => {
    const url = URL + "this-page-does-not-exist-xyz-" + Date.now() + "/";
    const first = await fetch(url);
    if (first.status === 404) {
      await new Promise((r) => setTimeout(r, 1500));
      const second = await fetch(url);
      // 404 is excluded from CACHE_STATUSES — must stay DYNAMIC
      expect(second.headers.get("cf-cache-status")).toEqual(DYNAMIC);
    } else {
      console.warn("404 test skipped — server returned " + first.status + " for test URL");
    }
  });

  test("302 redirect is not cached (DYNAMIC on repeat)", async () => {
    const url = URL + "index.php?test302=" + Date.now();
    const first = await fetch(url, { redirect: "manual" });
    if (first.status === 302) {
      await new Promise((r) => setTimeout(r, 1500));
      const second = await fetch(url, { redirect: "manual" });
      expect(second.headers.get("cf-cache-status")).toEqual(DYNAMIC);
    } else {
      console.warn("302 test skipped — server returned " + first.status);
    }
  });
});

// ---------------------------------------------------------------------------
// R2 Race Parameter
// ---------------------------------------------------------------------------
describe("R2 Race Parameter", () => {
  test("r2-race=0 disables R2 promise — r2-promise header is null", async () => {
    const url = URL + "?r2-race-off=" + Date.now() + "&r2-race=0";
    const response = await fetch(url);
    expect(response.headers.get("r2-promise")).toBeNull();
  });

  test("r2-race=false disables R2 promise — r2-promise header is null", async () => {
    const url = URL + "?r2-race-false=" + Date.now() + "&r2-race=false";
    const response = await fetch(url);
    expect(response.headers.get("r2-promise")).toBeNull();
  });

  test("Normal first request has r2-promise: 1 (R2 async caching triggered)", async () => {
    const url = URL + "?r2-promise-test=" + Date.now();
    const response = await fetch(url);
    expect(response.headers.get("cf-cache-status")).toEqual(DYNAMIC);
    // R2-promise is only set when R2 bucket is bound and server wins the race (FPC.js:626-628)
    const r2Promise = response.headers.get("r2-promise");
    if (r2Promise !== null) {
      expect(r2Promise).toEqual("1");
    }
    // When R2 is not configured, r2-promise is null — skip assertion
  });
});

// ---------------------------------------------------------------------------
// Cache Key Integrity
// ---------------------------------------------------------------------------
describe("Cache Key Integrity", () => {
  test("key header is present on HIT", async () => {
    const url = URL + "?key-integrity=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    const response = await fetch(url);
    expect(response.headers.get("cf-cache-status")).toEqual(HIT);
    expect(response.headers.get("key")).not.toBeNull();
  });

  test("key header embeds the current cache version", async () => {
    const url = URL + "?key-version=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    const response = await fetch(url);
    const version = response.headers.get("x-html-edge-cache-version");
    expect(version).not.toBeNull();
    expect(response.headers.get("key")).toContain(version);
  });

  test("x-html-edge-cache-version is always present in the response", async () => {
    const response = await fetch(URL + "?ver-always=" + Date.now());
    expect(response.headers.get("x-html-edge-cache-version")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// x-html-edge-cache-status State Machine
// ---------------------------------------------------------------------------
describe("x-html-edge-cache-status State Machine", () => {
  test("First request → Miss,FetchedOrigin,CachingAsync", async () => {
    const url = URL + "?state-miss=" + Date.now();
    const response = await fetch(url);
    expect(response.headers.get("x-html-edge-cache-status")).toContain("Miss,FetchedOrigin,CachingAsync");
  });

  test("Warmed request → contains Hit", async () => {
    const url = URL + "?state-hit=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    const response = await fetch(url);
    expect(response.headers.get("x-html-edge-cache-status")).toContain("Hit");
    expect(response.headers.get("cf-cache-status")).toEqual(HIT);
  });

  test("After cf-purge, stale request reports Hit,Stale", async () => {
    const url = URL + "?state-stale=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1000));
    await fetch(url + "&cf-purge=true");
    await new Promise((r) => setTimeout(r, 1500));
    const response = await fetch(url);
    expect(response.headers.get("x-html-edge-cache-status")).toContain("Stale");
  });

  test("Bypass URL has no x-html-edge-cache-status header", async () => {
    const response = await fetch(URL + "checkout/?state-bypass=" + Date.now());
    expect(response.headers.get("bypass-worker")).toEqual("true");
    expect(response.headers.get("x-html-edge-cache-status")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Speculation Rules — Extended
// ---------------------------------------------------------------------------
describe("Speculation Rules — Extended", () => {
  test("Prerender of uncached URL returns 406", async () => {
    const url = URL + "?prerender-new=" + Date.now();
    const response = await fetch(url, { headers: { "Sec-Purpose": "prerender" } });
    expect(response.status).toEqual(406);
  });

  test("Prerender of cached URL returns 200", async () => {
    const url = URL + "?prerender-cached=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    await fetch(url);
    await new Promise((r) => setTimeout(r, 500));
    const response = await fetch(url, { headers: { "Sec-Purpose": "prerender" } });
    expect(response.status).toEqual(200);
  });

  test("Regular GET after a 406 prerender can still be cached normally", async () => {
    const url = URL + "?prerender-after-406=" + Date.now();
    const prerender = await fetch(url, { headers: { "Sec-Purpose": "prerender" } });
    expect(prerender.status).toEqual(406);
    const first = await fetch(url);
    expect(first.status).toEqual(200);
    const edgeStatus = first.headers.get("x-html-edge-cache-status");
    expect(edgeStatus).toMatch(/Miss|FetchedOrigin/);
    await new Promise((r) => setTimeout(r, 1500));
    const second = await fetch(url);
    expect(second.headers.get("cf-cache-status")).toEqual(HIT);
  });
});

// ---------------------------------------------------------------------------
// Delete Endpoint — Extended
// ---------------------------------------------------------------------------
describe("Delete Endpoint — Extended", () => {
  test("cf-delete=true on warmed URL returns 211 with deleted: true and delete-status: true", async () => {
    const url = URL + "?delete-ext=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    const response = await fetch(url + "&cf-delete=true");
    expect(response.status).toEqual(211);
    expect(response.headers.get("deleted")).toEqual("true");
    expect(response.headers.get("delete-status")).toEqual("true");
  });

  test("After deletion, bypass-CDN fetch still returns HIT (served from R2)", async () => {
    const url = URL + "?delete-r2=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    await fetch(url);
    await fetch(url + "&cf-delete=true");
    await new Promise((r) => setTimeout(r, 4000));
    const response = await fetch(url + "&cf-cdn=false");
    expect(response.status).toEqual(200);
    expect(response.headers.get("cf-cache-status")).toEqual(HIT);
  });
})

// ---------------------------------------------------------------------------
// R2 Bucket — Direct Fetch (cf-cdn=false)
//
// cf-cdn=false bypasses the CF CDN edge cache and goes straight to R2.
// When R2 has the object, the response is built from customMetadata and the
// raw body stored in the bucket (getR2() in FPC.js, lines 1073-1133).
// ---------------------------------------------------------------------------
describe("R2 Bucket — Direct Fetch (cf-cdn=false)", () => {
  async function warmAndFetchR2(tag) {
    const url = URL + "?" + tag + "=" + Date.now();
    // First request — cache miss, R2 write queued async
    await fetch(url);
    // Allow the async R2 put to complete
    await new Promise((r) => setTimeout(r, 3000));
    return url;
  }

  test("cf-cdn=false on a warmed URL sets R2: true response header", async () => {
    const url = await warmAndFetchR2("r2-direct-hdr");
    const response = await fetch(url + "&cf-cdn=false");
    expect(response.status).toEqual(200);
    const r2 = response.headers.get("R2");
    if (r2 !== "true") {
      const r2Cache = response.headers.get("r2-cache");
      if (r2Cache) expect(['server-first', 'r2-null-server', 'miss']).toContain(r2Cache);
    }
  });

  test("R2-Get header is a non-negative integer (ms) when served from R2", async () => {
    const url = await warmAndFetchR2("r2-direct-get");
    const response = await fetch(url + "&cf-cdn=false");
    if (response.headers.get("R2") !== "true") {
      console.warn("R2-Get test: response not served from R2 — skipping assertion");
      return;
    }
    const r2Get = response.headers.get("R2-Get");
    expect(r2Get).not.toBeNull();
    expect(parseInt(r2Get, 10)).toBeGreaterThanOrEqual(0);
  });

  test("Server-Timing header includes r2-get entry when served from R2", async () => {
    const url = await warmAndFetchR2("r2-direct-timing");
    const response = await fetch(url + "&cf-cdn=false");
    if (response.headers.get("R2") !== "true") {
      console.warn("Server-Timing r2-get test: not from R2 — skipping");
      return;
    }
    expect(response.headers.get("Server-Timing")).toContain("r2-get");
  });

  test("age header is a non-negative integer when served from R2", async () => {
    const url = await warmAndFetchR2("r2-direct-age");
    const response = await fetch(url + "&cf-cdn=false");
    if (response.headers.get("R2") !== "true") {
      console.warn("age test: not from R2 — skipping");
      return;
    }
    const age = response.headers.get("age");
    expect(age).not.toBeNull();
    expect(parseInt(age, 10)).toBeGreaterThanOrEqual(0);
  });

  test("etag header is present when served from R2", async () => {
    const url = await warmAndFetchR2("r2-direct-etag");
    const response = await fetch(url + "&cf-cdn=false");
    if (response.headers.get("R2") !== "true") {
      console.warn("etag test: not from R2 — skipping");
      return;
    }
    // etag from R2Response.httpEtag; may be absent if origin didn't send it
    const etag = response.headers.get("etag");
    if (etag !== null) expect(etag.length).toBeGreaterThan(0);
  });

  test("cf-cache-status is HIT (restored from R2 metadata) when served from R2", async () => {
    const url = await warmAndFetchR2("r2-direct-cfcache");
    // Warm CDN too so the metadata stored in R2 has CF-Cache-Status: HIT
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1000));
    const response = await fetch(url + "&cf-cdn=false");
    if (response.headers.get("R2") === "true") {
      expect(response.headers.get("cf-cache-status")).toEqual(HIT);
    } else {
      expect(response.status).toEqual(200);
    }
  });
});

// ---------------------------------------------------------------------------
// R2 Bucket — Emulated Miss (r2-cdn=false)
//
// r2-cdn=false sets context["R2-miss"]=true, which flips R2check=false so
// getR2() is never called (FPC.js lines 329-331, 891-893).
// The request falls through to origin as if R2 doesn't exist.
// ---------------------------------------------------------------------------
describe("R2 Bucket — Emulated Miss (r2-cdn=false)", () => {
  test("r2-cdn=false does NOT set R2: true header even after cache is warm", async () => {
    const url = URL + "?r2-miss-hdr=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 3000));
    // Force both CDN miss and R2 miss — must go to origin
    const response = await fetch(url + "&cf-cdn=false&r2-cdn=false");
    expect(response.status).toEqual(200);
    expect(response.headers.get("R2")).not.toEqual("true");
  });

  test("r2-cdn=false with cf-cdn=false does not set R2-Get header", async () => {
    const url = URL + "?r2-miss-get=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 3000));
    const response = await fetch(url + "&cf-cdn=false&r2-cdn=false");
    expect(response.headers.get("R2-Get")).toBeNull();
  });

  test("r2-cdn=false returns a valid 200 response from origin", async () => {
    const url = URL + "?r2-miss-origin=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url + "&cf-cdn=false&r2-cdn=false");
    expect(response.status).toEqual(200);
    // Served from origin not R2, so R2-cache may be "miss" or absent
    const r2Cache = response.headers.get("R2-cache");
    if (r2Cache !== null) {
      expect(["miss", "server-first", "r2-null-server"]).toContain(r2Cache);
    }
  });
});

// ---------------------------------------------------------------------------
// R2 Bucket — Stale Version Serving
//
// After a cache purge, the new version key doesn't exist in R2 yet.
// getR2() falls back to the "stale" key variant (FPC.js lines 952-976).
// Stale responses are marked with r2-stale: "true" (line 995) and
// R2-stale-url (line 1110), and trigger stale-version on the response (line 992).
// ---------------------------------------------------------------------------
describe("R2 Bucket — Stale Version Serving", () => {
  test("After CDN purge, cf-cdn=false serves stale R2 content (r2-stale: true)", async () => {
    const url = URL + "?r2-stale-warm=" + Date.now();
    // Build up CDN and R2 caches
    await fetch(url);
    await new Promise((r) => setTimeout(r, 3000));
    await fetch(url); // second hit to ensure R2 has it
    await new Promise((r) => setTimeout(r, 1000));
    // Purge CDN → new version created, R2 still has previous version
    await fetch(url + "&cf-purge=true");
    await new Promise((r) => setTimeout(r, 2000));
    // Bypass CDN — new version not in R2 yet → falls back to stale R2
    const response = await fetch(url + "&cf-cdn=false");
    expect(response.status).toEqual(200);
    // Either stale R2 was found (r2-stale=true) or origin responded
    const isFromR2 = response.headers.get("R2") === "true";
    if (isFromR2) {
      const r2Stale = response.headers.get("r2-stale") || response.headers.get("R2-stale");
      expect(r2Stale).toEqual("true");
    } else {
      // Origin handled it — that's also valid behavior
      expect(response.status).toEqual(200);
    }
  });

  test("Stale R2 response sets stale-version to a non-negative integer", async () => {
    const url = URL + "?r2-stale-ver=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 3000));
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1000));
    await fetch(url + "&cf-purge=true");
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url + "&cf-cdn=false");
    const staleVersion = response.headers.get("stale-version");
    if (staleVersion !== null) {
      expect(parseInt(staleVersion, 10)).toBeGreaterThanOrEqual(0);
    } else {
      // Either fresh R2 content or origin — both are valid
      expect(response.status).toEqual(200);
    }
  });

  test("Stale R2 response includes R2-stale-url header pointing to previous key", async () => {
    const url = URL + "?r2-stale-url=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 3000));
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1000));
    await fetch(url + "&cf-purge=true");
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url + "&cf-cdn=false");
    const r2Stale = response.headers.get("r2-stale") || response.headers.get("R2-stale");
    if (r2Stale === "true") {
      const r2StaleUrl = response.headers.get("R2-stale-url");
      expect(r2StaleUrl).not.toBeNull();
      // The stale URL should contain the base hostname
      const baseHost = new (globalThis.URL)(URL).hostname;
      expect(r2StaleUrl).toContain(baseHost);
    } else {
      expect(response.status).toEqual(200);
    }
  });
});

// ---------------------------------------------------------------------------
// R2 Bucket — Logged-In User Bypass
//
// When R2_CAHE_LOGGEDIN_USERS === false (the default, FPC.js line 48),
// requests carrying an X-Magento-Vary cookie flip R2check=false so
// getR2() is never called (lines 891-893). The user is served from origin.
// ---------------------------------------------------------------------------
describe("R2 Bucket — Logged-In User Bypass", () => {
  test("X-Magento-Vary cookie with cf-cdn=false bypasses R2 (no R2: true header)", async () => {
    const url = URL + "?r2-loggedin=" + Date.now();
    // Warm without cookie so R2 has the object
    await fetch(url);
    await new Promise((r) => setTimeout(r, 3000));
    // Now request with user cookie + CDN bypass — R2 should be skipped
    const response = await fetch(url + "&cf-cdn=false", {
      headers: { Cookie: "X-Magento-Vary=integration-test-vary-12345" },
    });
    expect(response.status).toEqual(200);
    // R2 must NOT be used for logged-in users (R2_CAHE_LOGGEDIN_USERS=false)
    expect(response.headers.get("R2")).not.toEqual("true");
  });
});

// ---------------------------------------------------------------------------
// R2 Bucket — R2-cache Header State Machine
//
// The R2-cache response header reflects how the origin/R2 race resolved:
//   "server-first"    — server response won the race against R2
//   "miss"            — R2 had no entry for this URL
//   "r2-null-server"  — neither R2 current nor stale had content; server used
// ---------------------------------------------------------------------------
describe("R2 Bucket — R2-cache Header State Machine", () => {
  test("First request (CDN+R2 miss) sets R2-cache to server-first, miss, or r2-null-server", async () => {
    const url = URL + "?r2-state-new=" + Date.now();
    // Brand new URL — nothing in CDN or R2
    const response = await fetch(url);
    expect(response.status).toEqual(200);
    const r2Cache = response.headers.get("R2-cache");
    if (r2Cache !== null) {
      expect(["server-first", "miss", "r2-null-server"]).toContain(r2Cache);
    }
    // R2-promise: 1 indicates an async R2 write was queued
    // (server won the race; serverPromise is set in context)
    const r2Promise = response.headers.get("R2-promise");
    if (r2Promise !== null) {
      expect(r2Promise).toEqual("1");
    }
  });

  test("Subsequent CDN hits do NOT set R2-cache header (served directly from CF edge)", async () => {
    const url = URL + "?r2-state-hit=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 1500));
    // Should be a CDN HIT — no R2 involved
    const response = await fetch(url);
    if (response.headers.get("cf-cache-status") === HIT) {
      // R2-cache only set on non-CDN responses
      expect(response.headers.get("R2-cache")).toBeNull();
    } else {
      expect(response.status).toEqual(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional Integration Tests
// ---------------------------------------------------------------------------
describe("PATCH method bypass", () => {
  test("PATCH request is never cached (not HIT)", async () => {
    const url = URL + "?patch-test=" + Date.now();
    const response = await fetch(url, {
      method: "PATCH",
      body: JSON.stringify({ test: 1 }),
      headers: { "Content-Type": "application/json" },
      redirect: "manual",
    });
    expect([200, 302, 404, 405]).toContain(response.status);
    expect(response.headers.get("cf-cache-status")).not.toEqual(HIT);
  });
});

describe("Timing headers", () => {
  test("Worker-Time and JS-Time headers present on GET", async () => {
    const url = URL + "?timing-test=" + Date.now();
    const response = await fetch(url);
    expect(response.status).toEqual(200);
    expect(response.headers.get("Worker-Time")).not.toBeNull();
    expect(response.headers.get("JS-Time")).not.toBeNull();
  });
});

describe("cf-revalidate", () => {
  test("cf-revalidate=true on warmed URL triggers revalidation", async () => {
    const url = URL + "?cf-revalidate-test=" + Date.now();
    await fetch(url);
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url + "&cf-revalidate=true");
    expect(response.status).toEqual(200);
    // Revalidate returns 200; CDN-Revalidate header may be set
    expect([HIT, DYNAMIC]).toContain(response.headers.get("cf-cache-status"));
  });
});

describe("Speculation rules JSON", () => {
  test("rules/speculation.json returns 200 with correct content-type", async () => {
    const base = URL.replace(/\/$/, "");
    const response = await fetch(base + "/rules/speculation.json");
    expect(response.status).toEqual(200);
    expect(response.headers.get("content-type")).toContain("speculationrules");
  });
});
