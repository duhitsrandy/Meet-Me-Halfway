from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

db = SQLAlchemy()

class Route(db.Model):
    __tablename__ = 'routes'
    
    id = db.Column(db.Integer, primary_key=True)
    start_location = db.Column(db.String(255), nullable=False)
    end_location = db.Column(db.String(255), nullable=False)
    start_lat = db.Column(db.Float, nullable=False)
    start_lon = db.Column(db.Float, nullable=False)
    end_lat = db.Column(db.Float, nullable=False)
    end_lon = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    meeting_points = db.relationship('MeetingPoint', backref='route', lazy=True)

class MeetingPoint(db.Model):
    __tablename__ = 'meeting_points'
    
    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    travel_time1 = db.Column(db.Integer)  # Travel time from start in minutes
    travel_time2 = db.Column(db.Integer)  # Travel time from end in minutes
    pois = db.relationship('POI', backref='meeting_point', lazy=True)

class POI(db.Model):
    __tablename__ = 'pois'
    
    id = db.Column(db.Integer, primary_key=True)
    meeting_point_id = db.Column(db.Integer, db.ForeignKey('meeting_points.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(100))
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    address = db.Column(db.String(255))
    details = db.Column(db.JSON)
