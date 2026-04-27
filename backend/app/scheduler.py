import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

log = logging.getLogger(__name__)


def _run_osm():
    from data.etl_overpass import run
    log.info("Scheduler: OSM ETL starting")
    try:
        run()
        log.info("Scheduler: OSM ETL completed")
    except Exception as exc:
        log.error("Scheduler: OSM ETL failed: %s", exc)


def _run_gva():
    from data.etl_gva import run
    log.info("Scheduler: GVA ETL starting")
    try:
        run()
        log.info("Scheduler: GVA ETL completed")
    except Exception as exc:
        log.error("Scheduler: GVA ETL failed: %s", exc)


def _run_levels():
    from data.etl_levels import run
    log.info("Scheduler: Levels ETL starting")
    try:
        run()
        log.info("Scheduler: Levels ETL completed")
    except Exception as exc:
        log.error("Scheduler: Levels ETL failed: %s", exc)


def create_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    # OSM: 1st of every month at 03:00
    scheduler.add_job(_run_osm, CronTrigger(day=1, hour=3, minute=0), id="etl_osm")
    # GVA: 1st of January, April, July, October at 04:00
    scheduler.add_job(_run_gva, CronTrigger(month="1,4,7,10", day=1, hour=4, minute=0), id="etl_gva")
    # Levels (WFS oficial): after each GVA run, same days at 05:00
    scheduler.add_job(_run_levels, CronTrigger(month="1,4,7,10", day=1, hour=5, minute=0), id="etl_levels")
    return scheduler
