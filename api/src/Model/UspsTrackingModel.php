<?php

namespace App\Model;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Annotations\Annotation\Attribute;

class UspsTrackingModel
{
    public $trackInfo;

    /**
     * @param UspsTrackInfo[]
     * @throws \Exception
     */
    public function setTrackInfo(array $trackInfo)
    {
        $collection = new ArrayCollection();

        foreach ($trackInfo as $track) {
            if (!$track instanceof UspsTrackInfo) {
                throw new \Exception(sprintf("Must be of type %s", UspsTrackInfo::class));
            }
            $collection->add($track);
        }
        $this->trackInfo = $collection;
    }

    public function getTrackInfo(): ArrayCollection
    {
        return $this->trackInfo;
    }
}

class UspsTrackInfo
{
    public $class;
    public function setClass(string $class)
    {
        $this->class = $class;
    }
    /**
     * @var string[]
     */
    public $service;
    /**
     * @param string[]
     */
    public function setService($service)
    {
        $this->service = array_map(function ($s) {
            return preg_replace("/\<.+\>/", "", $s);
        }, (array) $service);
    }

    public function getService(): array
    {
        return $this->service;
    }

    /**
     * @var bool
     */
    public $onTime;
    public function setOnTime(string $onTime)
    {
        $this->onTime = $onTime === "true";
    }

    public $summary;
    /**
     * @param UspsTrackSummary
     */
    public function setTrackSummary(UspsTrackSummary $summary)
    {
        $this->summary = $summary;
    }

    public $expectedDeliveryDate;
    public function setExpectedDeliveryDate(string $deliveryDate)
    {
        $this->expectedDeliveryDate = new \DateTime($deliveryDate);
    }

    public $predictedDeliveryDate;
    public function setPredictedDeliveryDate(string $deliveryDate)
    {
        $this->predictedDeliveryDate = new \DateTime($deliveryDate);
    }

    public $trackDetail;

    /**
     * @param UspsTrackDetail[]
     */
    public function setTrackDetail(array $trackDetail)
    {
        $collection = new ArrayCollection();

        foreach ($trackDetail as $track) {
            if (!$track instanceof UspsTrackDetail) {
                throw new \Exception(sprintf("Must be of type %s", UspsTrackDetail::class));
            }
            $collection->add($track);
        }
        $this->trackDetail = $collection;
    }
    public function getTrackDetail(): ArrayCollection
    {
        return $this->trackDetail;
    }
}

class UspsTrackSummary
{
    use UspsEventDate;
    public $event;
    public function setEvent(string $event)
    {
        $this->event = $event;
    }
}

class UspsTrackDetail
{
    use UspsEventDate;
    public $event;
    public function setEvent(string $event)
    {
        $this->event = $event;
    }
    public $eventCity;
    public function setEventCity(string $eventCity)
    {
        $this->eventCity = $eventCity;
    }
    public $eventState;
    public function setEventState(string $eventState)
    {
        $this->eventState = $eventState;
    }
}

trait UspsEventDate
{
    /**
     * @var \DateTimeInterface
     */
    public $eventDate;
    public function setEventDate(string $eventDate)
    {
        $this->eventDate = new \DateTime($eventDate);
    }
    public function getEventDate(): \DateTimeInterface
    {
        return $this->eventDate;
    }
}
