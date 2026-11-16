from typing import List, Dict, Any
import math


def calculate_bearing_exposure(wind_dir_deg: float, exposed_bearings: List[int], tolerance_deg: float = 30.0) -> bool:
    """Checks if the incoming wind/swell direction falls within any exposed bearing sector of the anchorage."""
    for bearing in exposed_bearings:
        diff = abs((wind_dir_deg - bearing + 180) % 360 - 180)
        if diff <= tolerance_deg:
            return True
    return False


def compute_anchorage_score(
    vessel_draft_m: float,
    vessel_loa_m: float,
    min_depth_m: float,
    seabed_type: str,
    exposed_bearings: List[int],
    wind_speed_kn: float,
    wind_gust_kn: float,
    wind_dir_deg: float,
    wave_height_m: float,
    tide_amplitude_m: float = 2.4,
    freeboard_m: float = 1.4,
) -> Dict[str, Any]:
    """
    Crosses GRIB/Open-Meteo Marine forecast with vessel draft and anchorage spatial geometry.
    Calculates safety score (0-100), under-keel clearance, recommended chain scope, and swing radius.
    """
    score = 100
    warnings: List[str] = []
    recommendations: List[str] = []

    # 1. Under-keel clearance check at low tide
    ukc_m = round(min_depth_m - vessel_draft_m, 2)
    if ukc_m < 0.5:
        score -= 55
        warnings.append(f"Peligro crítico de varada: margen bajo quilla (UKC) de solo {ukc_m}m en bajamar.")
    elif ukc_m < 1.2:
        score -= 25
        warnings.append(f"Margen bajo quilla ajustado ({ukc_m}m). Fondear en cota mayor a {round(vessel_draft_m + 1.5, 1)}m.")
    else:
        recommendations.append(f"Margen bajo quilla seguro ({ukc_m}m sobre calado de {vessel_draft_m}m).")

    # 2. Wind & Swell exposure check
    is_exposed = calculate_bearing_exposure(wind_dir_deg, exposed_bearings)
    if is_exposed:
        score -= 35
        warnings.append(
            f"Viento pronosticado ({round(wind_dir_deg)}°) entra por sector expuesto del fondeadero ({exposed_bearings})."
        )
    else:
        recommendations.append(
            f"Excelente abrigo orográfico frente al viento del {round(wind_dir_deg)}°."
        )

    # 3. Wind speed & gusts
    effective_wind = max(wind_speed_kn, wind_gust_kn * 0.85)
    if effective_wind > 30:
        score -= 30
        warnings.append(f"Rachas fuertes ({round(wind_gust_kn, 1)} kn). Requiere ratio de cadena 7:1 y vigilancia continua.")
    elif effective_wind > 20:
        score -= 15
        warnings.append(f"Viento moderado-fuerte ({round(wind_speed_kn, 1)} kn). Usar ratio mínimo 5:1 con boza amortiguadora.")

    # 4. Seabed holding factor
    seabed_holding = {
        "sand": (0, "Arena firme (excelente tenedero)"),
        "mud": (-5, "Fango/Limo (buen tenedero, asentar ancla progresivamente)"),
        "mixed": (-12, "Fondo mixto (verificar agarre a 1.800 RPM en reversa)"),
        "weed": (-25, "Algas (riesgo de patinaje del ancla)"),
        "rock": (-35, "Piedra/Roca (alto riesgo de enroque o garreo, usar orinque)"),
    }
    penalty, seabed_desc = seabed_holding.get(seabed_type, (-10, seabed_type))
    score += penalty
    if penalty <= -20:
        warnings.append(f"Tenedero complejo: {seabed_desc}.")
    else:
        recommendations.append(f"Tenedero: {seabed_desc}.")

    # 5. Wave height check
    if wave_height_m > 1.2 and is_exposed:
        score -= 20
        warnings.append(f"Marejada de {wave_height_m}m entrando a la caleta.")

    score = max(0, min(100, score))
    if score >= 75:
        status = "SAFE"
    elif score >= 45:
        status = "CAUTION"
    else:
        status = "DANGER"

    # 6. Chain scope & Swing radius calculation
    scope_ratio = 7 if (effective_wind >= 22 or is_exposed or seabed_type in ("weed", "rock")) else 5
    max_water_depth = min_depth_m + tide_amplitude_m
    total_vertical_drop = max_water_depth + freeboard_m
    recommended_chain_m = math.ceil(total_vertical_drop * scope_ratio)
    horizontal_chain = math.sqrt(max(0.0, recommended_chain_m**2 - total_vertical_drop**2))
    swing_radius_m = round(horizontal_chain + vessel_loa_m + 5.0, 1)

    return {
        "score": score,
        "status": status,
        "under_keel_clearance_m": ukc_m,
        "is_wind_exposed": is_exposed,
        "scope_ratio": scope_ratio,
        "max_high_tide_depth_m": round(max_water_depth, 1),
        "recommended_chain_m": recommended_chain_m,
        "swing_radius_m": swing_radius_m,
        "seabed_description": seabed_desc,
        "warnings": warnings,
        "recommendations": recommendations,
    }
