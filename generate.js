import Crawler from "js-crawler";

// set in terminal: export URL="https://XXXXX.com/"
const URL = process.env.URL;

let urlsCrawledCount = 0;

function isSubredditUrl(url) {
    return !!url.includes(URL);
}

var crawler = new Crawler().configure({
    shouldCrawl: function (url) {
        return isSubredditUrl(url) || url == URL;
    },
    // Also possible to configure maximum 1 request per 10 seconds
    // maxRequestsPerSecond: 0.1
    maxRequestsPerSecond: 2,
    maxConcurrentRequests: 3,
    depth: 3
});

crawler.crawl(URL,
    function onSuccess(page) {
        console.log(page.url);
        urlsCrawledCount++;
        if(urlsCrawledCount % 100 === 0) {
            console.log("Generated: " + urlsCrawledCount);
        }
    },
    function onFailure(page) {
        console.log("ERROR Fetch(" + page.url + ") status = " + page.status);
        urlsCrawledCount++;
    },
    function onAllFinished(crawledUrls) {
        console.log('All generating finished');
        console.log('Urls generated = ' + urlsCrawledCount);
    }
);