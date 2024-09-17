### Start Redis (Docker)

From the node-js-crash-course directory, start Redis using `docker-compose` (note: use `docker-compose` with the "-", **not** "`docker compose`":

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
127.0.0.1:6379> hgetall ncc:locations:106

 1) "id"
 2) "106"
 3) "name"
 4) "Viva Bubble Tea"
 5) "category"
 6) "cafe"
 7) "location"
 8) "-122.268645,37.764288"
 9) "numLikes"
10) "886"
11) "numStars"
12) "1073"
13) "averageStars"
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
10) "$2b$05$uV38PUcdFD3Gm6ElMlBkE.lzZutqWVE6R6ro48GsEjcmnioaZZ55C"
11) "numCheckins"
12) "8945"
13) "lastCheckin"
14) "1490641385511"
15) "lastSeenAt"
16) "22"

127.0.0.1:6379> xlen ncc:checkins
(integer) 5000
```

## Start the Application

- npm run dev
- npm run auth (enable login)
- npm run auth (create cookie user)
- npm run checkinreceiver (stream API)
- npm run checkinprocessor (compile likes and update items)
- npm run checkingenerator (test service and generate dummy data)

## Routes

- [Item](http://localhost:8081/api/item/1)
- [Item w detail](http://localhost:8081/api/item/1?withDetails=true)
