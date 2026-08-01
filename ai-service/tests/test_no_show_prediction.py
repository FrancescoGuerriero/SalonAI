from datetime import date, datetime, timedelta, timezone
from app.schemas.no_show_prediction import NoShowPredictionRequest
from app.services.no_show_predictor import predict_no_shows

def item(key, no_shows=0, reminder="sent", deposit="none"):
    return {"appointment_key":key,"customer_key":"c-"+key,"appointment_date":(datetime.now(timezone.utc)+timedelta(days=3)).isoformat(),"service_name":"Cut","appointment_value":80,"lead_time_days":21,"previous_bookings":4,"previous_completed":4-no_shows,"previous_no_shows":no_shows,"previous_cancellations":0,"reschedule_count":0,"reminder_status":reminder,"deposit_status":deposit}
def payload(): return {"as_of_date":date.today().isoformat(),"appointments":[item("high",3,"none"),item("low",0,"confirmed","paid")],"settings":{"medium_risk_threshold":0.35,"high_risk_threshold":0.65}}
def test_ranking():
    result=predict_no_shows(NoShowPredictionRequest(**payload()))
    assert result.predictions[0].appointment_key=="high"
    assert result.predictions[0].risk_level=="high"
def test_protection_reduces_risk():
    result=predict_no_shows(NoShowPredictionRequest(**payload()))
    assert result.predictions[-1].probability < .35
def test_endpoint_requires_key(client): assert client.post("/api/v1/no-show-prediction/predict",json=payload()).status_code==401
def test_endpoint(client,auth_headers): assert client.post("/api/v1/no-show-prediction/predict",headers=auth_headers,json=payload()).status_code==200
