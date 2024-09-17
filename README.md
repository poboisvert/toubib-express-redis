### Installation and Setup

Before you begin, ensure you have Docker installed on your system. If you haven't already, download and install Docker from the official Docker website: <https://www.docker.com/get-docker>

### Start Redis (Docker)

From the node-js-crash-course directory, start Redis using `docker-compose` (note: use `docker-compose` with the "-", **not** "`docker compose`"):

```bash
$ docker-compose up -d

Creating network "node-js-crash-course_default" with the default driver
Creating rediscrashcourse ... done

$ docker ps
```

The output from the `docker ps` command should show one container running, using the "redislabs/redismod" image. This container runs Redis 6 with the RediSearch, RedisJSON and RedisBloom modules.

### Load the Sample Data into Redis

Load the course example data using the provided data loader. This is a Node.js application:

```bash
$ npm run load all
> node src/utils/dataloader.js -- "all"

Loading user data...
User data loaded with 0 errors.
Loading location data...
Location data loaded with 0 errors.
Loading location details...
Location detail data loaded with 0 errors.
Loading checkin stream entries...
Loaded 5000 checkin stream entries.
Creating consumer group...
Consumer group created.
Dropping any existing indexes, creating new indexes...
Created indexes.
Deleting any previous bloom filter, creating new bloom filter...
Created bloom filter.
```

In another terminal window, run the `redis-cli` executable that's in the Docker container. Then, enter the Redis commands shown at the redis-cli prompt to verify that data loaded successfully:

```bash
$ docker exec -it rediscrashcourse redis-cli
127.0.0.1:6379> hgetall ncc:items:1
 1) "id"
 2) "1"
 3) "name"
 4) "Jan's Place"
 5) "category"
 6) "cafe"
 7) "location"
 8) "-122.193849,38.10476999999999"
 9) "numLikes"
10) "1"
11) "averageStars"
12) "1"
13) "numStars"
14) "1"

127.0.0.1:6379> hgetall ncc:users:12
 1) "id"
 2) "12"
 3) "firstName"
 4) "Franziska"
 5) "lastName"
 6) "Sieben"
 7) "email"
 8) "franziska.sieben@example.com"
 9) "password"
10) "$2b$05$xltUvd3btY0RQPGLtGp0iOcyxk4nC8oUZsjnI8GsKYPyAH1C/3B6."
11) "numCheckins"
12) "8945"
13) "lastCheckin"
14) "1490641385511"
15) "lastSeenAt"
16) "22"
17) "numLikes"
18) "8945"

127.0.0.1:6379> xlen ncc:likes
(integer) 5000
```

## Application Startup

To initiate the application, execute the following commands in separate terminal windows:

- `npm run dev`: Initiates the primary application server.
- `npm run auth`: Activates login functionality.
- `npm run auth`: Establishes a cookie user for authentication purposes.
- `npm run checkinreceiver`: Initiates the stream API for processing checkins.
- `npm run checkinprocessor`: Compiles likes and updates items.
- `npm run checkingenerator`: Tests the service and generates dummy data.

## Accessible Routes

After the application is running, you can access the following routes:

- [Item](http://localhost:8081/api/item/1)
- [Item with Details](http://localhost:8081/api/item/1?withDetails=true)
- [Latest Items](http://localhost:8081/api/items/latest)
- [Latest likes](http://localhost:8081/api/likes/latest)
