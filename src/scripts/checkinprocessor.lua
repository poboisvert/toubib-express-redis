-- Example call from Redis
-- EVALSHA <sha> 2 user_hash_key location_hash_key timestamp location_id star_rating

local userKey = KEYS[1]
local itemKey = KEYS[2]
local checkinTimestamp = ARGV[1]
local checkinLocationId = ARGV[2]
local checkinStarRating = ARGV[3]

-- If the supplied timestamp is greater than the stored lastCheckin
-- timestamp, update it and the lastSeenAt field too.  If there isn't 
-- a current lastCheckin timestamp, use the value provided.
local currentLastCheckin = redis.call('hget', userKey, 'lastCheckin')

if ((currentLastCheckin == false or currentLastCheckin == nil)) or (tonumber(checkinTimestamp) > tonumber(currentLastCheckin)) then
    -- Update lastCheckin and lastSeenAt fields.
    redis.call('hset', userKey, 'lastCheckin', checkinTimestamp, 'lastSeenAt', checkinLocationId)
end

-- Increment the user's numVotes and the location's numVotes.
redis.call('hincrby', userKey, 'numVotes', 1)
local locationNumVotes = redis.call('hincrby', itemKey, 'numVotes', 1)

-- Update the location's total star count.
local locationNumStars = redis.call('hincrby', itemKey, 'numStars', tonumber(checkinStarRating))

-- Calculate and store the location's new average star count.
local newAverageStars = math.floor((locationNumStars / locationNumVotes) + 0.5)
redis.call('hset', itemKey, 'averageStars', tonumber(newAverageStars))
redis.call('hset', itemKey, 'lastUpdated', checkinTimestamp)
