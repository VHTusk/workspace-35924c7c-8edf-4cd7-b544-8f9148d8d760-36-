/**
 * City Detail API with Caching
 * GET /api/city/[cityId] - Get city overview (Module 1)
 * 
 * Cache Configuration:
 * - TTL: 300 seconds (5 minutes)
 * - Stale-while-revalidate: 60 seconds
 * - Invalidate on: User profile update
 * 
 * Cache Headers:
 * - X-Cache: HIT/MISS/STALE
 * - X-Cache-TTL: remaining seconds
 * - Cache-Control: public, max-age=300
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCityOverview, getOrCreateCity } from '@/lib/city-utils';
import { SportType } from '@prisma/client';
import {
  cacheResponse,
  generateCacheKeyFromParts,
  addCacheHeaders,
  API_CACHE_PREFIXES,
  ENDPOINT_CACHE_CONFIGS,
} from '@/lib/api-cache';

// GET /api/city/[cityId] - City Overview
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  try {
    const { cityId } = await params;
    
    // Generate cache key
    const cacheKey = generateCacheKeyFromParts(
      API_CACHE_PREFIXES.CITY_STATS,
      cityId
    );

    // Get cache config
    const cacheConfig = ENDPOINT_CACHE_CONFIGS.cityStats;

    // Execute with caching
    const result = await cacheResponse(
      request,
      cacheKey,
      cacheConfig,
      async () => {
        // Try to find city by cityId first (VH-CITY-DELHI-DARTS format)
        let city = await db.city.findUnique({
          where: { cityId },
        });
        
        // If not found, try to find by record ID
        if (!city) {
          city = await db.city.findUnique({
            where: { id: cityId },
          });
        }
        
        // If still not found, try to parse cityId and create
        if (!city) {
          // Try to parse: VH-CITY-CITYNAME-STATE-SPORT
          const parts = cityId.replace('VH-CITY-', '').split('-');
          if (parts.length >= 3) {
            const sport = parts.pop() as SportType;
            const state = parts.pop();
            const cityName = parts.join(' '); // Handle multi-word city names
            
            if (sport && state && cityName) {
              city = await getOrCreateCity(cityName, state, sport);
            }
          }
        }
        
        if (!city) {
          return null;
        }
        
        // Get full overview
        const overview = await getCityOverview(city.id);
        
        if (!overview) {
          return null;
        }
        
        return {
          city: {
            id: city.id,
            cityId: city.cityId,
            cityName: city.cityName,
            state: city.state,
            sport: city.sport,
          },
          overview,
        };
      }
    );

    // Handle null result (city not found)
    if (!result.data) {
      return NextResponse.json(
        { success: false, error: 'City not found' },
        { status: 404 }
      );
    }

    // Build response with cache headers
    const response = NextResponse.json({
      success: true,
      data: result.data.overview,
      city: result.data.city,
    });
    return addCacheHeaders(response, result.fromCache, result.ttlRemaining, cacheConfig.ttl, result.isStale);
    
  } catch (error) {
    console.error('Error fetching city overview:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch city overview' },
      { status: 500 }
    );
  }
}
