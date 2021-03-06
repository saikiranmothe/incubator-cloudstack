// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.api.commands;

import org.apache.log4j.Logger;

import com.cloud.api.ApiConstants;
import com.cloud.api.BaseAsyncCreateCmd;
import com.cloud.api.BaseCmd;
import com.cloud.api.IdentityMapper;
import com.cloud.api.Implementation;
import com.cloud.api.Parameter;
import com.cloud.api.ServerApiException;
import com.cloud.api.response.TrafficTypeResponse;
import com.cloud.async.AsyncJob;
import com.cloud.event.EventTypes;
import com.cloud.exception.ResourceAllocationException;
import com.cloud.network.PhysicalNetworkTrafficType;
import com.cloud.user.Account;
import com.cloud.user.UserContext;

@Implementation(description="Adds traffic type to a physical network", responseObject=TrafficTypeResponse.class, since="3.0.0")
public class AddTrafficTypeCmd extends BaseAsyncCreateCmd {
    public static final Logger s_logger = Logger.getLogger(AddTrafficTypeCmd.class.getName());

    private static final String s_name = "addtraffictyperesponse";

    /////////////////////////////////////////////////////
    //////////////// API parameters /////////////////////
    /////////////////////////////////////////////////////
    
    @IdentityMapper(entityTableName="physical_network")
    @Parameter(name=ApiConstants.PHYSICAL_NETWORK_ID, type=CommandType.LONG, required=true, description="the Physical Network ID")
    private Long physicalNetworkId;
    
    @Parameter(name=ApiConstants.TRAFFIC_TYPE, type=CommandType.STRING, required=true, description="the trafficType to be added to the physical network")
    private String trafficType;
    
    @Parameter(name=ApiConstants.XEN_NETWORK_LABEL, type=CommandType.STRING, description="The network name label of the physical device dedicated to this traffic on a XenServer host")
    private String xenLabel;
    
    @Parameter(name=ApiConstants.KVM_NETWORK_LABEL, type=CommandType.STRING, description="The network name label of the physical device dedicated to this traffic on a KVM host")
    private String kvmLabel;
    
    @Parameter(name=ApiConstants.VMWARE_NETWORK_LABEL, type=CommandType.STRING, description="The network name label of the physical device dedicated to this traffic on a VMware host")
    private String vmwareLabel;
        
    @Parameter(name=ApiConstants.VLAN, type=CommandType.STRING, description="The VLAN id to be used for Management traffic by VMware host")
    private String vlan;

    /////////////////////////////////////////////////////
    /////////////////// Accessors ///////////////////////
    /////////////////////////////////////////////////////
    
    @Override
    public String getEntityTable() {
        return "physical_network_traffic_types";
    }

    public Long getPhysicalNetworkId() {
        return physicalNetworkId;
    }

    public String getTrafficType() {
        return trafficType;
    }

    public String getXenLabel() {
        return xenLabel;
    }

    public String getKvmLabel() {
        return kvmLabel;
    }

    public String getVmwareLabel() {
        return vmwareLabel;
    }
    
    public String getSimulatorLabel() {
    	//simulators will have no labels
    	return null; 
    }

    public void setVlan(String vlan) {
        this.vlan = vlan;
    }

    public String getVlan() {
        return vlan;
    }

    /////////////////////////////////////////////////////
    /////////////// API Implementation///////////////////
    /////////////////////////////////////////////////////

    @Override
    public String getCommandName() {
        return s_name;
    }
    
    @Override
    public long getEntityOwnerId() {
        return Account.ACCOUNT_ID_SYSTEM;
    }
    
    @Override
    public void execute(){
        UserContext.current().setEventDetails("TrafficType Id: "+getEntityId());
        PhysicalNetworkTrafficType result = _networkService.getPhysicalNetworkTrafficType(getEntityId());
        if (result != null) {
            TrafficTypeResponse response = _responseGenerator.createTrafficTypeResponse(result);
            response.setResponseName(getCommandName());
            this.setResponseObject(response);
        }else {
            throw new ServerApiException(BaseCmd.INTERNAL_ERROR, "Failed to add traffic type to physical network");
        }
    }

    @Override
    public void create() throws ResourceAllocationException {
        PhysicalNetworkTrafficType result = _networkService.addTrafficTypeToPhysicalNetwork(getPhysicalNetworkId(), getTrafficType(), getXenLabel(), getKvmLabel(), getVmwareLabel(), getSimulatorLabel(), getVlan());
        if (result != null) {
            setEntityId(result.getId());
        } else {
            throw new ServerApiException(BaseCmd.INTERNAL_ERROR, "Failed to add traffic type to physical network");
        }        
    }

    @Override
    public String getEventType() {
        return EventTypes.EVENT_TRAFFIC_TYPE_CREATE;
    }
    
    @Override
    public String getEventDescription() {
        return  "Adding physical network traffic type: " + getEntityId();
    }
    
    @Override
    public AsyncJob.Type getInstanceType() {
        return AsyncJob.Type.TrafficType;
    }
}
