# CloudFlare Worker FPC
CloudFlare(CF) CDN Worker Full Page Cache(FPC) Layer for Magento 2.
It has become true. Now, it is Open Source and free. 
The original idea was the Shopify FPC cache from the CloudFlare CDN.

![image](https://github.com/user-attachments/assets/1dcb535e-3d0d-4e0a-b399-9f331807420d)

# How it works
The Edge Worker Magento full-page cache feature helps you optimize eCommerce performance by caching your Magento backend server's generated HTML or API response. 

CF Edge Worker Magent Full-page cache intercepts incoming requests and checks if a cached version of the requested content is available in the CloudFlare locations or in the cache Reserve. This check for the cached version can have the following outcomes, depending on its state:

 - If a cached version is found and it's not stale, then the cached content is served to the user. No request is made to the Magento Server.
 - If a cached version is found and it is stale, then the cached content is served to the user. The CF worker is executed in the background and requests a new version of the page caches from the Magento backend server for future requests. CF FPC is revalidated from the server asynchronously after 5 minutes or so, but you can change the time and logic.
 - If a cached version isn't found, the CF FPC worker sends a request to the Magento server to be used for future requests.

# Caching criteria
For CF FPC Worker to consider a response from a Magento backend as cacheable, the response must meet the following criteria:

 - Be a response to a GET request
 - Have a 2XX or 3XX status code.
 - Have a public Cache-Control header set with a non zero max-age, or s-maxage, value
 - Url doesn't match the worker's blacklist

# Worker and CF cache limitations:
 - The full-page cache is designed to work with the default magento cache, which is PHP Built-in FPC, FAST FPC (See repo: https://github.com/Genaker/FastFPC), or Varnish. You can try to use it as a main cache (see Cache Reserve), but it is not what it was designed for. ***The main idea of the CF Worker FPC Cache is Magento 2 pages are always served from the CF cache with async revalidation.**
 - You can't clear the cache by page. You can clear the entire cache only. That is why you need a default magento cache. However, it is designed to work without any cache clears. The worker will update it asynchronously. You mark the entire cache stale by changing its version. To hard clear the cache, you need to change the version twice. CF Worker checks the previous cache version to see if it is a stale cache.

## Installation
Open Cloud Flare and Go to Workers

![image](https://github.com/user-attachments/assets/9366da1d-8c40-4d38-9834-7f16f9805c3b)

Upgrading the plan to a bundle of 5$ months is better to avoid limitations.

![image](https://github.com/user-attachments/assets/b7579fc4-0509-4828-8fc3-2bd04e531b56)

Bundle: 

![image](https://github.com/user-attachments/assets/2613e81c-ec95-4387-82b4-f740da954707)

Workers features
Includes 10 million requests per month 3

Up to 50ms CPU time per request
Always lowest latency
Key-value storage features 4
10 million read operations per month
1 million write, delete, list operations per month

# Create KV (KeyValue) Storage to keep the cache version and some global settings 

![image](https://github.com/user-attachments/assets/38b22514-f827-41b9-b254-7da684afa685)

# Create Worker 

![image](https://github.com/user-attachments/assets/3ba61a60-1f19-488a-903e-88416054911e)


# Insert CF Worker FPC Code from The repo 


# Configure Worker

![image](https://github.com/user-attachments/assets/ccb4ba67-bc60-492e-a6d7-99ac6cdf983b)

![image](https://github.com/user-attachments/assets/7955f63a-541e-44e9-b650-40901ea3af97)

# Set your website route and worker to trigger:

![image](https://github.com/user-attachments/assets/405b8681-ed58-470f-8627-d5cde01f3dfc)

![image](https://github.com/user-attachments/assets/da91073b-7982-4b12-8b2a-b0fb92424168)

Done! Test it using Dev Console. 

![image](https://github.com/user-attachments/assets/7545b416-b5e5-4f3e-82c2-142e7edb2522)

You can also exclude some page rules, such as static and media, from workers. It will save money on request. 

![image](https://github.com/user-attachments/assets/2b6efc70-99ae-49a7-bbba-3eb4f174e636)

Also, Enable CF Cache Reserve to increase edge cache HIT rate. You can exclude media and static from the cache reserve to reduce CF costs. However, cache reserve is a nice stuff, and you can benefit from storing images in it. 

![image](https://github.com/user-attachments/assets/0c1bc4df-483e-45c8-b3a2-44cfe6dab817)

Please update this documentation when you will do it yourself. It is just a fast-written manual. 
For detailed information, check the Worker code. 

If you have any issues, create an issue or email me: egorshitikov[A]gmail.com

# Cache Debug Cockies
You can add any cookies you want just by changing the script.

# Default Cookies: 
![image](https://github.com/user-attachments/assets/cdc29850-b8cf-4549-ad73-6b494927931a)

# Cloud Flare Default cookies: 

![image](https://github.com/user-attachments/assets/94f38f9f-1fa1-4119-96ef-1ffa4c7867b2)

# Cache Reserve 

Cache Reserve is a large, persistent data store implemented on top of CF R2. Your website’s cacheable FPC content will be written to Cache Reserve. Cache Reserve serves as the ultimate upper-tier cache, reserving storage space for your FPC for as long as you want. This ensures that your FPC is served from the cache. Cache Reserve is a CF feature that allows the use of Claud Flare as a main cache solution. 

![image](https://github.com/user-attachments/assets/e8facd2a-0240-4c69-941d-8dd04b18055c)



