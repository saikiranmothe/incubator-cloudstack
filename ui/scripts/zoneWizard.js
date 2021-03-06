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

(function(cloudStack, $) {
  var selectedNetworkOfferingHavingSG = false;
  var selectedNetworkOfferingHavingEIP = false;
  var selectedNetworkOfferingHavingELB = false;
	var selectedNetworkOfferingHavingNetscaler = false;
  var returnedPublicVlanIpRanges = []; //public VlanIpRanges returned by API
  var configurationUseLocalStorage = false;
	var skipGuestTrafficStep = false;

  // Makes URL string for traffic label
  var trafficLabelParam = function(trafficTypeID, data, physicalNetworkID) {
    var zoneType = data.zone.networkType;
    var hypervisor = data.zone.hypervisor;
    physicalNetworkID = zoneType == 'Advanced' ? physicalNetworkID : 0;
    var physicalNetwork = data.physicalNetworks ? data.physicalNetworks[physicalNetworkID] : null;
    var trafficConfig = physicalNetwork ? physicalNetwork.trafficTypeConfiguration[trafficTypeID] : null;
    var trafficLabel = trafficConfig ? trafficConfig.label : null;
    var hypervisorAttr, trafficLabelStr;

    switch(hypervisor) {
      case 'XenServer':
        hypervisorAttr = 'xennetworklabel';
        break;
      case 'KVM':
        hypervisorAttr = 'kvmnetworklabel';
        break;
      case 'VMware':
        hypervisorAttr = 'vmwarenetworklabel';
        break;
      case 'BareMetal':
        hypervisorAttr = 'baremetalnetworklabel';
        break;
      case 'Ovm':
        hypervisorAttr = 'ovmnetworklabel';
        break;
    }

    trafficLabelStr = trafficLabel ? '&' + hypervisorAttr + '=' + trafficLabel : '';

    return trafficLabelStr;
  };

  cloudStack.zoneWizard = {
    // Return required traffic types, for configure physical network screen
    requiredTrafficTypes: function(args) {
      if (args.data.zone.networkType == 'Basic' && (selectedNetworkOfferingHavingEIP ||
                                                    selectedNetworkOfferingHavingELB)) {
        return [
          'management',
          'guest',
          'public'
        ];
      } else if (args.data.zone.networkType == 'Advanced') {
        return [
          'management',
          'public',
          'guest'
        ];
      } else {
        return [
          'management',
          'guest'
        ];
      }
    },

    disabledTrafficTypes: function(args) {
      if (args.data.zone.networkType == 'Basic' && (selectedNetworkOfferingHavingEIP ||
                                                    selectedNetworkOfferingHavingELB)) {
        return [];
      } else if (args.data.zone.networkType == 'Basic') {
        return ['public'];
      } else {
        return [];
      }

    },

    cloneTrafficTypes: function(args) {
      if (args.data.zone.networkType == 'Advanced') {
        return ['guest'];
      } else {
        return [];
      }
    },

    customUI: {
      publicTrafficIPRange: function(args) {
        var multiEditData = [];
        var totalIndex = 0;

        return $('<div>').multiEdit({
          context: args.context,
          noSelect: true,															
          fields: {
            'gateway': { edit: true, label: 'label.gateway' },
            'netmask': { edit: true, label: 'label.netmask' },
            'vlanid': { edit: true, label: 'label.vlan', isOptional: true },
            'startip': { edit: true, label: 'label.start.IP' },
            'endip': { edit: true, label: 'label.end.IP' },
            'add-rule': { label: 'label.add', addButton: true }
          },
          add: {
            label: 'label.add',
            action: function(args) {
              multiEditData.push($.extend(args.data, {
                index: totalIndex
              }));

              totalIndex++;
              args.response.success();
            }
          },
          actions: {
            destroy: {
              label: 'label.remove.rule',
              action: function(args) {
                multiEditData = $.grep(multiEditData, function(item) {
                  return item.index != args.context.multiRule[0].index;
                });
                args.response.success();
              }
            }
          },
          dataProvider: function(args) {
            args.response.success({
              data: multiEditData
            });
          }
        });
      },

      storageTrafficIPRange: function(args) {
        var multiEditData = [];
        var totalIndex = 0;

        return $('<div>').multiEdit({
          context: args.context,
          noSelect: true,
          fields: {
					  'gateway': { edit: true, label: 'label.gateway' },			
            'netmask': { edit: true, label: 'label.netmask' },
            'vlan': { edit: true, label: 'label.vlan', isOptional: true },
            'startip': { edit: true, label: 'label.start.IP' },
            'endip': { edit: true, label: 'label.end.IP' },
            'add-rule': { label: 'label.add', addButton: true }
          },
          add: {
            label: 'label.add',
            action: function(args) {
              multiEditData.push($.extend(args.data, {
                index: totalIndex
              }));

              totalIndex++;
              args.response.success();
            }
          },
          actions: {
            destroy: {
              label: 'label.remove.rule',
              action: function(args) {
                multiEditData = $.grep(multiEditData, function(item) {
                  return item.index != args.context.multiRule[0].index;
                });
                args.response.success();
              }
            }
          },
          dataProvider: function(args) {
            args.response.success({
              data: multiEditData
            });
          }
        });
      }
    },

    preFilters: {
		  addNetscalerDevice: function(args) { //add Netscaler
        var isShown;        
				if(selectedNetworkOfferingHavingNetscaler == true) {
          isShown = true;
          $('.conditional.netscaler').show();
        } else {
          isShown= false;
          $('.conditional.netscaler').hide();
        }
        return isShown;
      },
		
      addPublicNetwork: function(args) {		
        var isShown;
				var $publicTrafficDesc = $('.zone-wizard:visible').find('#add_zone_public_traffic_desc');	 
        if(args.data['network-model'] == 'Basic') {
          if(selectedNetworkOfferingHavingSG == true && selectedNetworkOfferingHavingEIP == true && selectedNetworkOfferingHavingELB == true) {
            isShown = true;
          }
          else {            
            isShown = false;
          }			
					
					$publicTrafficDesc.find('#for_basic_zone').css('display', 'inline');
					$publicTrafficDesc.find('#for_advanced_zone').hide();					
        }
        else { //args.data['network-model'] == 'Advanced'          
          isShown = true;					
					
					$publicTrafficDesc.find('#for_advanced_zone').css('display', 'inline');
					$publicTrafficDesc.find('#for_basic_zone').hide();					
        }
        return isShown;
      },   

      setupPhysicalNetwork: function(args) {
        if (args.data['network-model'] == 'Basic' &&
            !(selectedNetworkOfferingHavingELB && selectedNetworkOfferingHavingEIP)) {
          $('.setup-physical-network .info-desc.conditional.basic').show();
          $('.setup-physical-network .info-desc.conditional.advanced').hide();
          $('.subnav li.public-network').hide();
        } else {
          $('.setup-physical-network .info-desc.conditional.basic').hide();
          $('.setup-physical-network .info-desc.conditional.advanced').show();
          $('.subnav li.public-network').show();
        }
        return true; // Both basic & advanced zones show physical network UI
      },

      configureGuestTraffic: function(args) {
        if (args.data['network-model'] == 'Basic') {
          $('.setup-guest-traffic').addClass('basic');
          $('.setup-guest-traffic').removeClass('advanced');
					skipGuestTrafficStep = false; //set value
        } 
				else {
          $('.setup-guest-traffic').removeClass('basic');
          $('.setup-guest-traffic').addClass('advanced');
					
					//skip the step if OVS tunnel manager is enabled	
          skipGuestTrafficStep = false; //reset it before ajax call
					$.ajax({
						url: createURL('listConfigurations'),
						data: {
							name: 'sdn.ovs.controller'
						},
						dataType: "json",
						async: false,
						success: function(json) {					 
							var items = json.listconfigurationsresponse.configuration; //2 entries returned: 'sdn.ovs.controller', 'sdn.ovs.controller.default.label'
							$(items).each(function(){						  
								if(this.name == 'sdn.ovs.controller') {
									if(this.value == 'true' || this.value == true) {
										skipGuestTrafficStep = true;
									}
									return false; //break each loop
								}
							});						
						}
					});	
        }
				return !skipGuestTrafficStep;
      },

      configureStorageTraffic: function(args) {
        return $.grep(args.groupedData.physicalNetworks, function(network) {
          return $.inArray('storage', network.trafficTypes) > -1;
        }).length;
      },

      addHost: function(args) {		
        return (args.groupedData.zone.hypervisor != "VMware");
      },
						
			addPrimaryStorage: function(args) {
        return args.data.localstorageenabled != 'on';
      }	
    },

    forms: {
      zone: {
        preFilter: function(args) {
          var $form = args.$form;

          if (args.data['network-model'] == 'Basic') {
            args.$form.find('[rel=networkOfferingId]').show();
            args.$form.find('[rel=guestcidraddress]').hide();
          }
          else { //args.data['network-model'] == 'Advanced'
            args.$form.find('[rel=networkOfferingId]').hide();
            args.$form.find('[rel=guestcidraddress]').show();
          }													
										
          setTimeout(function() {
            if ($form.find('input[name=ispublic]').is(':checked')) {
              $form.find('[rel=domain]').hide();
            }
          });
        },
        fields: {
          name: {
            label: 'label.name', validation: { required: true },
            desc: 'message.tooltip.zone.name'
          },
          dns1: {
            label: 'label.dns.1', validation: { required: true },
            desc: 'message.tooltip.dns.1'
          },
          dns2: {
            label: 'label.dns.2',
            desc: 'message.tooltip.dns.2'
          },
          internaldns1: {
            label: 'label.internal.dns.1', validation: { required: true },
            desc: 'message.tooltip.internal.dns.1'
          },
          internaldns2: {
            label: 'label.internal.dns.2',
            desc: 'message.tooltip.internal.dns.2'
          },
          hypervisor: {
            label: 'label.hypervisor',
            validation: { required: true },
            select: function(args) {
              $.ajax({
                url: createURL('listHypervisors'),
                async: false,
                data: { listAll: true },
                success: function(json) {								 
									var items = json.listhypervisorsresponse.hypervisor;
									var array1 = [];
									if(items != null) {
									  for(var i = 0; i < items.length; i++) {
										  if(items[i].name == "XenServer")
											  array1.unshift({id: items[i].name, description: items[i].name});
											else
											  array1.push({id: items[i].name, description: items[i].name});
										}
									}								  
                  args.response.success({
                    data: array1
                  });
                }
              });
            }
          },
          networkOfferingId: {
            label: 'label.network.offering',
						dependsOn: 'hypervisor',
            select: function(args) {
              var selectedNetworkOfferingObj = {};
              var networkOfferingObjs = [];
              
							args.$select.unbind("change").bind("change", function(){									  
								//reset when different network offering is selected
								selectedNetworkOfferingHavingSG = false;
								selectedNetworkOfferingHavingEIP = false;
								selectedNetworkOfferingHavingELB = false;
								selectedNetworkOfferingHavingNetscaler = false;
								
								var selectedNetworkOfferingId = $(this).val();  
								$(networkOfferingObjs).each(function(){
									if(this.id == selectedNetworkOfferingId) {
										selectedNetworkOfferingObj = this;
										return false; //break $.each() loop
									}
								});
								
								if(selectedNetworkOfferingObj.havingNetscaler == true)
									selectedNetworkOfferingHavingNetscaler = true;
								if(selectedNetworkOfferingObj.havingSG == true)
									selectedNetworkOfferingHavingSG = true;
								if(selectedNetworkOfferingObj.havingEIP == true)
									selectedNetworkOfferingHavingEIP = true;
								if(selectedNetworkOfferingObj.havingELB == true)
									selectedNetworkOfferingHavingELB = true;	
							});									
							

              $.ajax({
                url: createURL("listNetworkOfferings&state=Enabled&guestiptype=Shared"),
                dataType: "json",
                async: false,
                success: function(json) {
                  networkOfferingObjs = json.listnetworkofferingsresponse.networkoffering;
									var availableNetworkOfferingObjs = [];							
									$(networkOfferingObjs).each(function() {									  
										var thisNetworkOffering = this;
										$(this.service).each(function(){
											var thisService = this;
																			
											$(thisService.provider).each(function(){										
												if(this.name == "Netscaler") {
													thisNetworkOffering.havingNetscaler = true;
													return false; //break each loop
												}
											});			
											
											if(thisService.name == "SecurityGroup") {
												thisNetworkOffering.havingSG = true;
											}
											else if(thisService.name == "StaticNat") {
												$(thisService.capability).each(function(){
													if(this.name == "ElasticIp" && this.value == "true") {
														thisNetworkOffering.havingEIP = true;
														return false; //break $.each() loop
													}
												});
											}
											else if(thisService.name == "Lb") {
												$(thisService.capability).each(function(){
													if(this.name == "ElasticLb" && this.value == "true") {
														thisNetworkOffering.havingELB = true;
														return false; //break $.each() loop
													}
												});
											}
										});
																				
										if(args.hypervisor != "VMware" && args.hypervisor != "BareMetal") {
										  availableNetworkOfferingObjs.push(thisNetworkOffering);
										}
										else { //only network offerings that does not include EIP, ELB, SG
										  if(thisNetworkOffering.havingSG != true && thisNetworkOffering.havingEIP != true && thisNetworkOffering.havingELB != true) {
											  availableNetworkOfferingObjs.push(thisNetworkOffering);
											}
										}		
									});																	
									
                  args.response.success({
                    data: $.map(availableNetworkOfferingObjs, function(offering) {
                      return {
                        id: offering.id,
                        description: offering.name
                      };
                    })
                  });		
                  
                }
              });										
            }
          },
          networkdomain: {
            label: 'label.network.domain',
            desc: 'message.tooltip.network.domain'
          },
          guestcidraddress: {
            label: 'label.guest.cidr',
            defaultValue: '10.1.1.0/24',
            validation: { required: false }
          },
          ispublic: {
            isReverse: true,
            isBoolean: true,
            label: 'label.public',
            isChecked: true //checked by default (public zone)
          },
          domain: {
            label: 'label.domain',
            dependsOn: 'ispublic',
            isHidden: true,
            select: function(args) {
              $.ajax({
                url: createURL("listDomains&listAll=true"),
                data: { viewAll: true },
                dataType: "json",
                async: false,
                success: function(json) {
                  domainObjs = json.listdomainsresponse.domain;
                  args.response.success({
                    data: $.map(domainObjs, function(domain) {
                      return {
                        id: domain.id,
                        description: domain.path
                      };
                    })
                  });
                }
              });
            }
          },
          localstorageenabled: {
            label: 'label.local.storage.enabled',
            isBoolean: true,
            onChange: function(args) {
              var $checkbox = args.$checkbox;

              if ($checkbox.is(':checked')) {
                cloudStack.dialog.confirm({
                  message: 'message.zoneWizard.enable.local.storage',
                  action: function() {
                    $checkbox.attr('checked', true);
                  },
                  cancelAction: function() {
                    $checkbox.attr('checked', false);
                  }
                });

                return false;
              }

              return true;
            }
          }
        }
      },

      pod: {
        fields: {
          name: {
            label: 'label.pod.name',
            validation: { required: true },
            desc: 'message.tooltip.pod.name'
          },
          reservedSystemGateway: {
            label: 'label.reserved.system.gateway',
            validation: { required: true },
            desc: 'message.tooltip.reserved.system.gateway'
          },
          reservedSystemNetmask: {
            label: 'label.reserved.system.netmask',
            validation: { required: true },
            desc: 'message.tooltip.reserved.system.netmask'
          },
          reservedSystemStartIp: {
            label: 'label.start.reserved.system.IP',
            validation: { required: true }
          },
          reservedSystemEndIp: {
            label: 'label.end.reserved.system.IP',
            validation: { required: false }
          }
        }
      },

      basicPhysicalNetwork: { //"Netscaler" now
        preFilter: function(args) {
          if (args.data['network-model'] == 'Basic' && (selectedNetworkOfferingHavingELB || selectedNetworkOfferingHavingEIP)) {
            args.$form.find('[rel=dedicated]').hide();
          } else {
            args.$form.find('[rel=dedicated]').show();
          };
          cloudStack.preFilter.addLoadBalancerDevice
        },
        fields: {
         ip: {
            label: 'label.ip.address'
          },
          username: {
            label: 'label.username'
          },
          password: {
            label: 'label.password',
            isPassword: true
          },
          networkdevicetype: {
            label: 'label.type',
            select: function(args) {
              var items = [];
              items.push({id: "NetscalerMPXLoadBalancer", description: "NetScaler MPX LoadBalancer"});
              items.push({id: "NetscalerVPXLoadBalancer", description: "NetScaler VPX LoadBalancer"});
              items.push({id: "NetscalerSDXLoadBalancer", description: "NetScaler SDX LoadBalancer"});
              args.response.success({data: items});
            }
          },
          publicinterface: {
            label: 'label.public.interface'
          },
          privateinterface: {
            label: 'label.private.interface'
          },
          numretries: {
            label: 'label.numretries',
            defaultValue: '2'
          },  
          dedicated: {
            label: 'label.dedicated',
            isBoolean: true,
            isChecked: false
          },
					capacity: {
            label: 'label.capacity',
            validation: { required: false, number: true }
          }
        }
      },

      guestTraffic: {
        preFilter: function(args) {				                 		
          var $guestTrafficDesc = $('.zone-wizard:visible').find('#add_zone_guest_traffic_desc');	 		     
					if (args.data['network-model'] == 'Basic') {
						$guestTrafficDesc.find('#for_basic_zone').css('display', 'inline');
						$guestTrafficDesc.find('#for_advanced_zone').hide();
					}
					else { //args.data['network-model'] == 'Advanced'
						$guestTrafficDesc.find('#for_advanced_zone').css('display', 'inline');
						$guestTrafficDesc.find('#for_basic_zone').hide();
					}		
				
          var selectedZoneObj = {
            networktype: args.data['network-model']
          };

          var advancedFields = ['vlanRange'];
          $(advancedFields).each(function() {
            if (selectedZoneObj.networktype == 'Advanced') {
              args.$form.find('[rel=' + this + ']').show();
            }
            else {
              args.$form.find('[rel=' + this + ']').hide();
            }
          });

          var basicFields = [
            'guestGateway',
            'guestNetmask',
            'guestStartIp',
            'guestEndIp'
          ];
          $(basicFields).each(function() {
             if (selectedZoneObj.networktype == 'Basic') {
              args.$form.find('[rel=' + this + ']').show();
            }
            else {
              args.$form.find('[rel=' + this + ']').hide();
            }
          });
        },

        fields: {
          //Basic (start)
          guestGateway: { label: 'label.guest.gateway' },
          guestNetmask: { label: 'label.guest.netmask' },
          guestStartIp: { label: 'label.guest.start.ip' },
          guestEndIp: { label: 'label.guest.end.ip' },
          //Basic (end)

          //Advanced (start)
          vlanRange: {
            label: 'label.vlan.range',
            range: ['vlanRangeStart', 'vlanRangeEnd'],
            validation: { required: false, digits: true }  //Bug 13517 - AddZone wizard->Configure guest traffic: Vlan is optional
          }
          //Advanced (end)
        }
      },
      cluster: {
        fields: {
          hypervisor: {
            label: 'label.hypervisor',
            select: function(args) {
              // Disable select -- selection is made on zone setup step
              args.$select.attr('disabled', 'disabled');

              $.ajax({
                url: createURL("listHypervisors"),
                dataType: "json",
                async: false,
                success: function(json) {
                  var hypervisors = json.listhypervisorsresponse.hypervisor;
                  var items = [];
                  $(hypervisors).each(function() {
                    items.push({id: this.name, description: this.name})
                  });
                  args.response.success({data: items});
                  args.$select.val(args.context.zones[0].hypervisor);
                  args.$select.change();
                }
              });

              var vSwitchEnabled = false;

              // Check whether vSwitch capability is enabled
              $.ajax({
                url: createURL('listConfigurations'),
                data: {
                  name: 'vmware.use.nexus.vswitch'
                },
                async: false,
                success: function(json) {
                  if (json.listconfigurationsresponse.configuration[0].value == 'true') {
                    vSwitchEnabled = true;
                  }
                }
              });

              args.$select.bind("change", function(event) {
                var $form = $(this).closest('form');
                var $vsmFields = $form.find('[rel]').filter(function() {
                  var vsmFields = [
                    'vsmipaddress',
                    'vsmusername',
                    'vsmpassword'
                  ];

                  return $.inArray($(this).attr('rel'), vsmFields) > -1;
                }); 

                if($(this).val() == "VMware") {
                  //$('li[input_sub_group="external"]', $dialogAddCluster).show();
                  $form.find('[rel=vCenterHost]').css('display', 'block');
                  $form.find('[rel=vCenterUsername]').css('display', 'block');
                  $form.find('[rel=vCenterPassword]').css('display', 'block');
                  $form.find('[rel=vCenterDatacenter]').css('display', 'block');

                  if (vSwitchEnabled) {
                    $vsmFields.css('display', 'block');
                  } else {
                    $vsmFields.css('display', 'none'); 
                  } 
                  //$("#cluster_name_label", $dialogAddCluster).text("vCenter Cluster:");
                }
                else {
                  //$('li[input_group="vmware"]', $dialogAddCluster).hide();
                  $form.find('[rel=vCenterHost]').css('display', 'none');
                  $form.find('[rel=vCenterUsername]').css('display', 'none');
                  $form.find('[rel=vCenterPassword]').css('display', 'none');
                  $form.find('[rel=vCenterDatacenter]').css('display', 'none');

                  //$("#cluster_name_label", $dialogAddCluster).text("Cluster:");
                }
              });
            }
          },
          name: {
            label: 'label.cluster.name',
            validation: { required: true }
          },

          //hypervisor==VMWare begins here
          vCenterHost: {
            label: 'label.vcenter.host',
            validation: { required: true }
          },
          vCenterUsername: {
            label: 'label.vcenter.username',
            validation: { required: true }
          },
          vCenterPassword: {
            label: 'label.vcenter.password',
            validation: { required: true },
            isPassword: true
          },
          vCenterDatacenter: {
            label: 'label.vcenter.datacenter',
            validation: { required: true }
          },
          vsmipaddress: {
            label: 'Nexus 1000v IP Address',
            validation: { required: true },
            isHidden: true
          },
          vsmusername: {
            label: 'Nexus 1000v Username',
            validation: { required: true },
            isHidden: true
          },
          vsmpassword: {
            label: 'Nexus 1000v Password',
            validation: { required: true },
            isPassword: true,
            isHidden: true
          } 
          //hypervisor==VMWare ends here
        }
      },
      host: {
        preFilter: function(args) {
          var selectedClusterObj = {
            hypervisortype: args.data.hypervisor
          };

          var $form = args.$form;

          if(selectedClusterObj.hypervisortype == "VMware") {
            //$('li[input_group="general"]', $dialogAddHost).hide();
            $form.find('[rel=hostname]').hide();
            $form.find('[rel=username]').hide();
            $form.find('[rel=password]').hide();

            //$('li[input_group="vmware"]', $dialogAddHost).show();
            $form.find('[rel=vcenterHost]').css('display', 'block');

            //$('li[input_group="baremetal"]', $dialogAddHost).hide();
            $form.find('[rel=baremetalCpuCores]').hide();
            $form.find('[rel=baremetalCpu]').hide();
            $form.find('[rel=baremetalMemory]').hide();
            $form.find('[rel=baremetalMAC]').hide();

            //$('li[input_group="Ovm"]', $dialogAddHost).hide();
            $form.find('[rel=agentUsername]').hide();
            $form.find('[rel=agentPassword]').hide();
          }
          else if (selectedClusterObj.hypervisortype == "BareMetal") {
            //$('li[input_group="general"]', $dialogAddHost).show();
            $form.find('[rel=hostname]').css('display', 'block');
            $form.find('[rel=username]').css('display', 'block');
            $form.find('[rel=password]').css('display', 'block');

            //$('li[input_group="baremetal"]', $dialogAddHost).show();
            $form.find('[rel=baremetalCpuCores]').css('display', 'block');
            $form.find('[rel=baremetalCpu]').css('display', 'block');
            $form.find('[rel=baremetalMemory]').css('display', 'block');
            $form.find('[rel=baremetalMAC]').css('display', 'block');

            //$('li[input_group="vmware"]', $dialogAddHost).hide();
            $form.find('[rel=vcenterHost]').hide();

            //$('li[input_group="Ovm"]', $dialogAddHost).hide();
            $form.find('[rel=agentUsername]').hide();
            $form.find('[rel=agentPassword]').hide();
          }
          else if (selectedClusterObj.hypervisortype == "Ovm") {
            //$('li[input_group="general"]', $dialogAddHost).show();
            $form.find('[rel=hostname]').css('display', 'block');
            $form.find('[rel=username]').css('display', 'block');
            $form.find('[rel=password]').css('display', 'block');

            //$('li[input_group="vmware"]', $dialogAddHost).hide();
            $form.find('[rel=vcenterHost]').hide();

            //$('li[input_group="baremetal"]', $dialogAddHost).hide();
            $form.find('[rel=baremetalCpuCores]').hide();
            $form.find('[rel=baremetalCpu]').hide();
            $form.find('[rel=baremetalMemory]').hide();
            $form.find('[rel=baremetalMAC]').hide();

            //$('li[input_group="Ovm"]', $dialogAddHost).show();
            $form.find('[rel=agentUsername]').css('display', 'block');
            $form.find('[rel=agentUsername]').find('input').val("oracle");
            $form.find('[rel=agentPassword]').css('display', 'block');
          }
          else {
            //$('li[input_group="general"]', $dialogAddHost).show();
            $form.find('[rel=hostname]').css('display', 'block');
            $form.find('[rel=username]').css('display', 'block');
            $form.find('[rel=password]').css('display', 'block');

            //$('li[input_group="vmware"]', $dialogAddHost).hide();
            $form.find('[rel=vcenterHost]').hide();

            //$('li[input_group="baremetal"]', $dialogAddHost).hide();
            $form.find('[rel=baremetalCpuCores]').hide();
            $form.find('[rel=baremetalCpu]').hide();
            $form.find('[rel=baremetalMemory]').hide();
            $form.find('[rel=baremetalMAC]').hide();

            //$('li[input_group="Ovm"]', $dialogAddHost).hide();
            $form.find('[rel=agentUsername]').hide();
            $form.find('[rel=agentPassword]').hide();
          }
        },
        fields: {
          hostname: {
            label: 'label.host.name',
            validation: { required: true },
            isHidden: true
          },

          username: {
            label: 'label.username',
            validation: { required: true },
            isHidden: true
          },

          password: {
            label: 'label.password',
            validation: { required: true },
            isHidden: true,
            isPassword: true
          },
          //input_group="general" ends here

          //input_group="VMWare" starts here
          vcenterHost: {
            label: 'label.esx.host',
            validation: { required: true },
            isHidden: true
          },
          //input_group="VMWare" ends here

          //input_group="BareMetal" starts here
          baremetalCpuCores: {
            label: 'label.num.cpu.cores',
            validation: { required: true },
            isHidden: true
          },
          baremetalCpu: {
            label: 'label.cpu.mhz',
            validation: { required: true },
            isHidden: true
          },
          baremetalMemory: {
            label: 'label.memory.mb',
            validation: { required: true },
            isHidden: true
          },
          baremetalMAC: {
            label: 'label.host.MAC',
            validation: { required: true },
            isHidden: true
          },
          //input_group="BareMetal" ends here

          //input_group="OVM" starts here
          agentUsername: {
            label: 'label.agent.username',
            validation: { required: false },
            isHidden: true
          },
          agentPassword: {
            label: 'label.agent.password',
            validation: { required: true },
            isHidden: true,
            isPassword: true
          },
          //input_group="OVM" ends here

          //always appear (begin)
          hosttags: {
            label: 'label.host.tags',
            validation: { required: false }
          }
          //always appear (end)
        }
      },
      primaryStorage: {  
        preFilter: function(args) {},

        fields: {
          name: {
            label: 'label.name',
            validation: { required: true }  
					},

          protocol: {
            label: 'label.protocol',
            validation: { required: true }, 
						select: function(args) {
              var selectedClusterObj = {
                hypervisortype: $.isArray(args.context.zones[0].hypervisor) ?
                  // We want the cluster's hypervisor type
                  args.context.zones[0].hypervisor[1] : args.context.zones[0].hypervisor
              };

              if(selectedClusterObj == null) {
                return;
              }

              if(selectedClusterObj.hypervisortype == "KVM") {
                var items = [];
                items.push({id: "nfs", description: "nfs"});
                items.push({id: "SharedMountPoint", description: "SharedMountPoint"});
                items.push({id: "clvm", description: "CLVM"});
                args.response.success({data: items});
              }
              else if(selectedClusterObj.hypervisortype == "XenServer") {
                var items = [];
                items.push({id: "nfs", description: "nfs"});
                items.push({id: "PreSetup", description: "PreSetup"});
                items.push({id: "iscsi", description: "iscsi"});
                args.response.success({data: items});
              }
              else if(selectedClusterObj.hypervisortype == "VMware") {
                var items = [];
                items.push({id: "nfs", description: "nfs"});
                items.push({id: "vmfs", description: "vmfs"});
                args.response.success({data: items});
              }
              else if(selectedClusterObj.hypervisortype == "Ovm") {
                var items = [];
                items.push({id: "nfs", description: "nfs"});
                items.push({id: "ocfs2", description: "ocfs2"});
                args.response.success({data: items});
              }
              else {
                args.response.success({data:[]});
              }

              args.$select.change(function() {
                var $form = $(this).closest('form');

                var protocol = $(this).val();
                
                $form.find('[rel=path]').find(".name").find("label").html('<span class=\"field-required\">*</span>Path:');
                
                if(protocol == null)
                  return;

                if(protocol == "nfs") {
                  //$("#add_pool_server_container", $dialogAddPool).show();
                  $form.find('[rel=server]').css('display', 'block');
                  //$dialogAddPool.find("#add_pool_nfs_server").val("");
                  $form.find('[rel=server]').find(".value").find("input").val("");

                  //$('li[input_group="nfs"]', $dialogAddPool).show();
                  $form.find('[rel=path]').css('display', 'block');
                  //$dialogAddPool.find("#add_pool_path_container").find("label").text(g_dictionary["label.path"]+":");
                  //$form.find('[rel=path]').find(".name").find("label").text("Path:");

                  //$('li[input_group="iscsi"]', $dialogAddPool).hide();
                  $form.find('[rel=iqn]').hide();
                  $form.find('[rel=lun]').hide();

                  //$('li[input_group="clvm"]', $dialogAddPool).hide();
                  $form.find('[rel=volumegroup]').hide();

                  //$('li[input_group="vmfs"]', $dialogAddPool).hide();
                  $form.find('[rel=vCenterDataCenter]').hide();
                  $form.find('[rel=vCenterDataStore]').hide();
                }
                else if(protocol == "ocfs2") {//ocfs2 is the same as nfs, except no server field.
                  //$dialogAddPool.find("#add_pool_server_container").hide();
                  $form.find('[rel=server]').hide();
                  //$dialogAddPool.find("#add_pool_nfs_server").val("");
                  $form.find('[rel=server]').find(".value").find("input").val("");

                  //$('li[input_group="nfs"]', $dialogAddPool).show();
                  $form.find('[rel=path]').css('display', 'block');
                  //$dialogAddPool.find("#add_pool_path_container").find("label").text(g_dictionary["label.path"]+":");
                  //$form.find('[rel=path]').find(".name").find("label").text("Path:");

                  //$('li[input_group="iscsi"]', $dialogAddPool).hide();
                  $form.find('[rel=iqn]').hide();
                  $form.find('[rel=lun]').hide();

                  //$('li[input_group="clvm"]', $dialogAddPool).hide();
                  $form.find('[rel=volumegroup]').hide();

                  //$('li[input_group="vmfs"]', $dialogAddPool).hide();
                  $form.find('[rel=vCenterDataCenter]').hide();
                  $form.find('[rel=vCenterDataStore]').hide();
                }
                else if(protocol == "PreSetup") {
                  //$dialogAddPool.find("#add_pool_server_container").hide();
                  $form.find('[rel=server]').hide();
                  //$dialogAddPool.find("#add_pool_nfs_server").val("localhost");
                  $form.find('[rel=server]').find(".value").find("input").val("localhost");

                  //$('li[input_group="nfs"]', $dialogAddPool).show();
                  $form.find('[rel=path]').css('display', 'block');
                  //$dialogAddPool.find("#add_pool_path_container").find("label").text(g_dictionary["label.SR.name"]+":");
                  $form.find('[rel=path]').find(".name").find("label").html("<span class=\"field-required\">*</span>SR Name-Label:");

                  //$('li[input_group="iscsi"]', $dialogAddPool).hide();
                  $form.find('[rel=iqn]').hide();
                  $form.find('[rel=lun]').hide();

                  //$('li[input_group="clvm"]', $dialogAddPool).hide();
                  $form.find('[rel=volumegroup]').hide();

                  //$('li[input_group="vmfs"]', $dialogAddPool).hide();
                  $form.find('[rel=vCenterDataCenter]').hide();
                  $form.find('[rel=vCenterDataStore]').hide();
                }
                else if(protocol == "iscsi") {
                  //$dialogAddPool.find("#add_pool_server_container").show();
                  $form.find('[rel=server]').css('display', 'block');
                  //$dialogAddPool.find("#add_pool_nfs_server").val("");
                  $form.find('[rel=server]').find(".value").find("input").val("");

                  //$('li[input_group="nfs"]', $dialogAddPool).hide();
                  $form.find('[rel=path]').hide();

                  //$('li[input_group="iscsi"]', $dialogAddPool).show();
                  $form.find('[rel=iqn]').css('display', 'block');
                  $form.find('[rel=lun]').css('display', 'block');

                  //$('li[input_group="clvm"]', $dialogAddPool).hide();
                  $form.find('[rel=volumegroup]').hide();

                  //$('li[input_group="vmfs"]', $dialogAddPool).hide();
                  $form.find('[rel=vCenterDataCenter]').hide();
                  $form.find('[rel=vCenterDataStore]').hide();
                }
                else if($(this).val() == "clvm") {
                  //$("#add_pool_server_container", $dialogAddPool).hide();
                  $form.find('[rel=server]').hide();
                  //$dialogAddPool.find("#add_pool_nfs_server").val("localhost");
                  $form.find('[rel=server]').find(".value").find("input").val("localhost");

                  //$('li[input_group="nfs"]', $dialogAddPool).hide();
                  $form.find('[rel=path]').hide();

                  //$('li[input_group="iscsi"]', $dialogAddPool).hide();
                   $form.find('[rel=iqn]').hide();
                  $form.find('[rel=lun]').hide();

                  //$('li[input_group="clvm"]', $dialogAddPool).show();
                  $form.find('[rel=volumegroup]').css('display', 'inline-block');

                  //$('li[input_group="vmfs"]', $dialogAddPool).hide();
                  $form.find('[rel=vCenterDataCenter]').hide();
                  $form.find('[rel=vCenterDataStore]').hide();
                }
                else if(protocol == "vmfs") {
                  //$dialogAddPool.find("#add_pool_server_container").show();
                  $form.find('[rel=server]').css('display', 'block');
                  //$dialogAddPool.find("#add_pool_nfs_server").val("");
                  $form.find('[rel=server]').find(".value").find("input").val("");

                  //$('li[input_group="nfs"]', $dialogAddPool).hide();
                  $form.find('[rel=path]').hide();

                  //$('li[input_group="iscsi"]', $dialogAddPool).hide();
                  $form.find('[rel=iqn]').hide();
                  $form.find('[rel=lun]').hide();

                  //$('li[input_group="clvm"]', $dialogAddPool).hide();
                  $form.find('[rel=volumegroup]').hide();

                  //$('li[input_group="vmfs"]', $dialogAddPool).show();
                  $form.find('[rel=vCenterDataCenter]').css('display', 'block');
                  $form.find('[rel=vCenterDataStore]').css('display', 'block');
                }
                else if(protocol == "SharedMountPoint") {  //"SharedMountPoint" show the same fields as "nfs" does.
                  //$dialogAddPool.find("#add_pool_server_container").hide();
                  $form.find('[rel=server]').hide();
                  //$dialogAddPool.find("#add_pool_nfs_server").val("localhost");
                  $form.find('[rel=server]').find(".value").find("input").val("localhost");

                  //$('li[input_group="nfs"]', $dialogAddPool).show();
                  $form.find('[rel=path]').css('display', 'block');
                  //$form.find('[rel=path]').find(".name").find("label").text("Path:");

                  //$('li[input_group="iscsi"]', $dialogAddPool).hide();
                  $form.find('[rel=iqn]').hide();
                  $form.find('[rel=lun]').hide();

                  //$('li[input_group="clvm"]', $dialogAddPool).hide();
                  $form.find('[rel=volumegroup]').hide();

                  //$('li[input_group="vmfs"]', $dialogAddPool).hide();
                  $form.find('[rel=vCenterDataCenter]').hide();
                  $form.find('[rel=vCenterDataStore]').hide();
                }
                else {
                  //$dialogAddPool.find("#add_pool_server_container").show();
                  $form.find('[rel=server]').css('display', 'block');
                  //$dialogAddPool.find("#add_pool_nfs_server").val("");
                  $form.find('[rel=server]').find(".value").find("input").val("");

                  //$('li[input_group="iscsi"]', $dialogAddPool).hide();
                  $form.find('[rel=iqn]').hide();
                  $form.find('[rel=lun]').hide();

                  //$('li[input_group="clvm"]', $dialogAddPool).hide();
                  $form.find('[rel=volumegroup]').hide();

                  //$('li[input_group="vmfs"]', $dialogAddPool).hide();
                  $form.find('[rel=vCenterDataCenter]').hide();
                  $form.find('[rel=vCenterDataStore]').hide();
                }
              });

              args.$select.trigger("change");
            }
          },
          server: {
            label: 'label.server',
            validation: { required: true },  
						isHidden: true
          },

          //nfs
          path: {
            label: 'label.path',
            validation: { required: true },  
						isHidden: true
          },

          //iscsi
          iqn: {
            label: 'label.target.iqn',
            validation: { required: true },  
						isHidden: true
          },
          lun: {
            label: 'label.LUN.number',
            validation: { required: true },  
						isHidden: true
          },

          //clvm
          volumegroup: {
            label: 'label.volgroup',
            validation: { required: true },  
						isHidden: true
          },

          //vmfs
          vCenterDataCenter: {
            label: 'label.vcenter.datacenter',
            validation: { required: true },  
						isHidden: true
          },
          vCenterDataStore: {
            label: 'label.vcenter.datastore',
            validation: { required: true },  
						isHidden: true
          },

          //always appear (begin)
          storageTags: {
            label: 'label.storage.tags',
            validation: { required: false }   
					}
          //always appear (end)
        }
      },
      secondaryStorage: {
        fields: {
          nfsServer: {
            label: 'label.nfs.server',
            validation: { required: true }
          },
          path: {
            label: 'label.path',
            validation: { required: true }
          }
        }
      }
    },

    action: function(args) {
      var advZoneConfiguredVirtualRouterCount = 0; //for multiple physical networks in advanced zone. Each physical network has 2 virtual routers: regular one and VPC one.

      var success = args.response.success;
      var error = args.response.error;
      var message = args.response.message;
      //var data = args.data;
      var startFn = args.startFn;
      var data = args.data;

      var stepFns = {
        addZone: function() {				
          message(dictionary['message.creating.zone']); 

          var array1 = [];
          var networkType = args.data.zone.networkType;  //"Basic", "Advanced"
          array1.push("&networktype=" + todb(networkType));
          if(networkType == "Advanced") {
            if(args.data.zone.guestcidraddress != null && args.data.zone.guestcidraddress.length > 0)
              array1.push("&guestcidraddress=" + todb(args.data.zone.guestcidraddress));
          }

          array1.push("&name=" + todb(args.data.zone.name));

          if (args.data.zone.localstorageenabled == 'on') {
            array1.push("&localstorageenabled=true");
          }
          array1.push("&dns1=" + todb(args.data.zone.dns1));

          var dns2 = args.data.zone.dns2;
          if (dns2 != null && dns2.length > 0)
            array1.push("&dns2=" + todb(dns2));

          array1.push("&internaldns1="+todb(args.data.zone.internaldns1));

          var internaldns2 = args.data.zone.internaldns2;
          if (internaldns2 != null && internaldns2.length > 0)
            array1.push("&internaldns2=" + todb(internaldns2));

					if(args.data.pluginFrom == null) { //from zone wizard, not from quick instsaller(args.data.pluginFrom != null && args.data.pluginFrom.name == 'installWizard') who doesn't have public checkbox
						if(args.data.zone.ispublic == null) //public checkbox in zone wizard is unchecked 
							array1.push("&domainid=" + args.data.zone.domain);
          }
					
          if(args.data.zone.networkdomain != null && args.data.zone.networkdomain.length > 0)
            array1.push("&domain=" + todb(args.data.zone.networkdomain));

          $.ajax({
            url: createURL("createZone" + array1.join("")),
            dataType: "json",
            async: false,
            success: function(json) {
              stepFns.addPhysicalNetworks({
                data: $.extend(args.data, {
                  returnedZone: json.createzoneresponse.zone
                })
              });
            },
            error: function(XMLHttpResponse) {
              var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
              error('addZone', errorMsg, { fn: 'addZone', args: args });
            }
          });
        },

        addPhysicalNetworks: function(args) {
          message(dictionary['message.creating.physical.networks']);

          var returnedPhysicalNetworks = [];

          if(args.data.zone.networkType == "Basic") { //Basic zone ***
            var requestedTrafficTypeCount = 2; //request guest traffic type, management traffic type
            if(selectedNetworkOfferingHavingSG == true && selectedNetworkOfferingHavingEIP == true && selectedNetworkOfferingHavingELB == true)
              requestedTrafficTypeCount++; //request public traffic type
						      				
						//Basic zone has only one physical network
						var array1 = [];	            
						if("physicalNetworks" in args.data) {	//from add-zone-wizard		
							array1.push("&name=" + todb(args.data.physicalNetworks[0].name));							
						}
						else { //from quick-install-wizard
						  array1.push("&name=PhysicalNetworkInBasicZone");
						}
							
            $.ajax({
              url: createURL("createPhysicalNetwork&zoneid=" + args.data.returnedZone.id + array1.join("")),
              dataType: "json",
              success: function(json) {
                var jobId = json.createphysicalnetworkresponse.jobid; 
								var createPhysicalNetworkIntervalID = setInterval(function() { 	
                  $.ajax({
                    url: createURL("queryAsyncJobResult&jobid=" + jobId),
                    dataType: "json",
                    success: function(json) {
                      var result = json.queryasyncjobresultresponse;
                      if (result.jobstatus == 0) {
                        return; //Job has not completed
                      }
                      else {                        
												clearInterval(createPhysicalNetworkIntervalID); 
												
                        if (result.jobstatus == 1) {
                          var returnedBasicPhysicalNetwork = result.jobresult.physicalnetwork;
                          var label = returnedBasicPhysicalNetwork.id + trafficLabelParam('guest', data);
                          var returnedTrafficTypes = [];

                          $.ajax({
                            url: createURL("addTrafficType&trafficType=Guest&physicalnetworkid=" + label),
                            dataType: "json",
                            success: function(json) {
                              var jobId = json.addtraffictyperesponse.jobid;                              
															var addGuestTrafficTypeIntervalID = setInterval(function() { 																
                                $.ajax({
                                  url: createURL("queryAsyncJobResult&jobid=" + jobId),
                                  dataType: "json",
                                  success: function(json) {
                                    var result = json.queryasyncjobresultresponse;
                                    if (result.jobstatus == 0) {
                                      return; //Job has not completed
                                    }
                                    else {                                      
																			clearInterval(addGuestTrafficTypeIntervalID); 
																			
                                      if (result.jobstatus == 1) {
                                        returnedTrafficTypes.push(result.jobresult.traffictype);

                                        if(returnedTrafficTypes.length == requestedTrafficTypeCount) { //all requested traffic types have been added
                                          returnedBasicPhysicalNetwork.returnedTrafficTypes = returnedTrafficTypes;

                                          stepFns.configurePhysicalNetwork({
                                            data: $.extend(args.data, {
                                              returnedBasicPhysicalNetwork: returnedBasicPhysicalNetwork
                                            })
                                          });
                                        }
                                      }
                                      else if (result.jobstatus == 2) {
                                        alert("Failed to add Guest traffic type to basic zone. Error: " + _s(result.jobresult.errortext));
                                      }
                                    }
                                  },
                                  error: function(XMLHttpResponse) {
                                    var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                    alert("Failed to add Guest traffic type to basic zone. Error: " + errorMsg);
                                  }
                                });                              
															}, 3000); 																
                            }
                          });

                          label = trafficLabelParam('management', data);

                          $.ajax({
                            url: createURL("addTrafficType&trafficType=Management&physicalnetworkid=" + returnedBasicPhysicalNetwork.id + label),
                            dataType: "json",
                            success: function(json) {
                              var jobId = json.addtraffictyperesponse.jobid;                             
															var addManagementTrafficTypeIntervalID = setInterval(function() { 	
                                $.ajax({
                                  url: createURL("queryAsyncJobResult&jobid=" + jobId),
                                  dataType: "json",
                                  success: function(json) {
                                    var result = json.queryasyncjobresultresponse;
                                    if (result.jobstatus == 0) {
                                      return; //Job has not completed
                                    }
                                    else {                                      
																			clearInterval(addManagementTrafficTypeIntervalID); 
																			
                                      if (result.jobstatus == 1) {
                                        returnedTrafficTypes.push(result.jobresult.traffictype);

                                        if(returnedTrafficTypes.length == requestedTrafficTypeCount) { //all requested traffic types have been added
                                          returnedBasicPhysicalNetwork.returnedTrafficTypes = returnedTrafficTypes;

                                          stepFns.configurePhysicalNetwork({
                                            data: $.extend(args.data, {
                                              returnedBasicPhysicalNetwork: returnedBasicPhysicalNetwork
                                            })
                                          });
                                        }
                                      }
                                      else if (result.jobstatus == 2) {
                                        alert("Failed to add Management traffic type to basic zone. Error: " + _s(result.jobresult.errortext));
                                      }
                                    }
                                  },
                                  error: function(XMLHttpResponse) {
                                    var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                    alert("Failed to add Management traffic type to basic zone. Error: " + errorMsg);
                                  }
                                });                              
															}, 3000); 	
                            }
                          });

                          // Storage traffic
                          if (data.physicalNetworks &&
                              $.inArray('storage', data.physicalNetworks[0].trafficTypes) > -1) {
                            label = trafficLabelParam('storage', data);
                            $.ajax({
                              url: createURL('addTrafficType&physicalnetworkid=' + returnedBasicPhysicalNetwork.id + '&trafficType=Storage' + label),
                              dataType: "json",
                              success: function(json) {
                                var jobId = json.addtraffictyperesponse.jobid;                                
																var addStorageTrafficTypeIntervalID = setInterval(function() { 	
                                  $.ajax({
                                    url: createURL("queryAsyncJobResult&jobid=" + jobId),
                                    dataType: "json",
                                    success: function(json) {
                                      var result = json.queryasyncjobresultresponse;
                                      if (result.jobstatus == 0) {
                                        return; //Job has not completed
                                      }
                                      else {                                        
																				clearInterval(addStorageTrafficTypeIntervalID); 
																				
                                        if (result.jobstatus == 1) {
                                          returnedTrafficTypes.push(result.jobresult.traffictype);

                                          if(returnedTrafficTypes.length == requestedTrafficTypeCount) { //all requested traffic types have been added
                                            returnedBasicPhysicalNetwork.returnedTrafficTypes = returnedTrafficTypes;

                                            stepFns.configurePhysicalNetwork({
                                              data: $.extend(args.data, {
                                                returnedBasicPhysicalNetwork: returnedBasicPhysicalNetwork
                                              })
                                            });
                                          }
                                        }
                                        else if (result.jobstatus == 2) {
                                          alert("Failed to add Management traffic type to basic zone. Error: " + _s(result.jobresult.errortext));
                                        }
                                      }
                                    },
                                    error: function(XMLHttpResponse) {
                                      var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                      alert("Failed to add Management traffic type to basic zone. Error: " + errorMsg);
                                    }
                                  });                                
																}, 3000); 	
                              }
                            });
                          }

                          if (selectedNetworkOfferingHavingSG == true && selectedNetworkOfferingHavingEIP == true && selectedNetworkOfferingHavingELB == true) {
                            label = trafficLabelParam('public', data);
                            $.ajax({
                              url: createURL("addTrafficType&trafficType=Public&physicalnetworkid=" + returnedBasicPhysicalNetwork.id + label),
                              dataType: "json",
                              success: function(json) {
                                var jobId = json.addtraffictyperesponse.jobid;                               
																var addPublicTrafficTypeIntervalID = setInterval(function() { 	
                                  $.ajax({
                                    url: createURL("queryAsyncJobResult&jobid=" + jobId),
                                    dataType: "json",
                                    success: function(json) {
                                      var result = json.queryasyncjobresultresponse;
                                      if (result.jobstatus == 0) {
                                        return; //Job has not completed
                                      }
                                      else {                                       
																				clearInterval(addPublicTrafficTypeIntervalID); 
																				
                                        if (result.jobstatus == 1) {
                                          returnedTrafficTypes.push(result.jobresult.traffictype);

                                          if(returnedTrafficTypes.length == requestedTrafficTypeCount) { //all requested traffic types have been added
                                            returnedBasicPhysicalNetwork.returnedTrafficTypes = returnedTrafficTypes;

                                            stepFns.configurePhysicalNetwork({
                                              data: $.extend(args.data, {
                                                returnedBasicPhysicalNetwork: returnedBasicPhysicalNetwork
                                              })
                                            });
                                          }
                                        }
                                        else if (result.jobstatus == 2) {
                                          alert("Failed to add Public traffic type to basic zone. Error: " + _s(result.jobresult.errortext));
                                        }
                                      }
                                    },
                                    error: function(XMLHttpResponse) {
                                      var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                      alert("Failed to add Public traffic type to basic zone. Error: " + errorMsg);
                                    }
                                  });                                
																}, 3000); 	
                              }
                            });
                          }
                        }
                        else if (result.jobstatus == 2) {
                          alert("createPhysicalNetwork failed. Error: " + _s(result.jobresult.errortext));
                        }
                      }
                    },
                    error: function(XMLHttpResponse) {
                      var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                      alert("createPhysicalNetwork failed. Error: " + errorMsg);
                    }
                  });                
								}, 3000); 	
								
              }
            });
          }
          else if(args.data.zone.networkType == "Advanced") {
            $(args.data.physicalNetworks).each(function(index) {
              var thisPhysicalNetwork = this;							
							var array1 = [];
							array1.push("&name=" + todb(thisPhysicalNetwork.name));
							if(thisPhysicalNetwork.isolationMethod != null && thisPhysicalNetwork.isolationMethod.length > 0)
							  array1.push("&isolationmethods=" + todb(thisPhysicalNetwork.isolationMethod));							
              $.ajax({
                url: createURL("createPhysicalNetwork&zoneid=" + args.data.returnedZone.id + array1.join("")),
                dataType: "json",
                success: function(json) {
                  var jobId = json.createphysicalnetworkresponse.jobid;                  
									var createPhysicalNetworkIntervalID = setInterval(function() { 	
                    $.ajax({
                      url: createURL("queryAsyncJobResult&jobid=" + jobId),
                      dataType: "json",
                      success: function(json) {
                        var result = json.queryasyncjobresultresponse;
                        if (result.jobstatus == 0) {
                          return; //Job has not completed
                        }
                        else {                          
													clearInterval(createPhysicalNetworkIntervalID); 
													
                          if (result.jobstatus == 1) {
                            var returnedPhysicalNetwork = result.jobresult.physicalnetwork;
                            returnedPhysicalNetwork.originalId = thisPhysicalNetwork.id;

                            var returnedTrafficTypes = [];
                            var label; // Traffic type label
                            $(thisPhysicalNetwork.trafficTypes).each(function(){
                              var thisTrafficType = this;
                              var apiCmd = "addTrafficType&physicalnetworkid=" + returnedPhysicalNetwork.id;
                              if(thisTrafficType == "public") {
                                apiCmd += "&trafficType=Public";
                                label = trafficLabelParam('public', data, index);
                              }
                              else if(thisTrafficType == "management") {
                                apiCmd += "&trafficType=Management";
                                label = trafficLabelParam('management', data, index);
                              }
                              else if(thisTrafficType == "guest") {
                                apiCmd += "&trafficType=Guest";
                                label = trafficLabelParam('guest', data, index);
                              }
                              else if(thisTrafficType == "storage") {
                                apiCmd += "&trafficType=Storage";
                                label = trafficLabelParam('storage', data, index);
                              }

                              $.ajax({
                                url: createURL(apiCmd + label),
                                dataType: "json",
                                success: function(json) {
                                  var jobId = json.addtraffictyperesponse.jobid;                                 
																	var addTrafficTypeIntervalID = setInterval(function() { 	
                                    $.ajax({
                                      url: createURL("queryAsyncJobResult&jobid=" + jobId),
                                      dataType: "json",
                                      success: function(json) {
                                        var result = json.queryasyncjobresultresponse;
                                        if (result.jobstatus == 0) {
                                          return; //Job has not completed
                                        }
                                        else {                                         
																					clearInterval(addTrafficTypeIntervalID); 
																					
                                          if (result.jobstatus == 1) {
                                            returnedTrafficTypes.push(result.jobresult.traffictype);

                                            if(returnedTrafficTypes.length == thisPhysicalNetwork.trafficTypes.length) { //this physical network is complete (specified traffic types are added)
                                              returnedPhysicalNetwork.returnedTrafficTypes = returnedTrafficTypes;
                                              returnedPhysicalNetworks.push(returnedPhysicalNetwork);

                                              if(returnedPhysicalNetworks.length == args.data.physicalNetworks.length) { //all physical networks are complete
                                                stepFns.configurePhysicalNetwork({
                                                  data: $.extend(args.data, {
                                                    returnedPhysicalNetworks: returnedPhysicalNetworks
                                                  })
                                                });
                                              }
                                            }
                                          }
                                          else if (result.jobstatus == 2) {
                                            alert(apiCmd + " failed. Error: " + _s(result.jobresult.errortext));
                                          }
                                        }
                                      },
                                      error: function(XMLHttpResponse) {
                                        var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                        alert(apiCmd + " failed. Error: " + errorMsg);
                                      }
                                    });                                  
																	}, 3000); 																		
                                }
                              });
                            });
                          }
                          else if (result.jobstatus == 2) {
                            alert("createPhysicalNetwork failed. Error: " + _s(result.jobresult.errortext));
                          }
                        }
                      },
                      error: function(XMLHttpResponse) {
                        var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                        alert("createPhysicalNetwork failed. Error: " + errorMsg);
                      }
                    });                  
									}, 3000); 	
                }
              });
            });
          }
        },

        //afterCreateZonePhysicalNetworkTrafficTypes: enable physical network, enable virtual router element, enable network service provider
        configurePhysicalNetwork: function(args) {
          message(dictionary['message.configuring.physical.networks']); 

          if(args.data.zone.networkType == "Basic") {
            $.ajax({
              url: createURL("updatePhysicalNetwork&state=Enabled&id=" + args.data.returnedBasicPhysicalNetwork.id),
              dataType: "json",
              success: function(json) { 
								var enablePhysicalNetworkIntervalID = setInterval(function() { 	
                  $.ajax({
                    url: createURL("queryAsyncJobResult&jobId=" + json.updatephysicalnetworkresponse.jobid),
                    dataType: "json",
                    success: function(json) {
                      var result = json.queryasyncjobresultresponse;
                      if (result.jobstatus == 0) {
                        return; //Job has not completed
                      }
                      else {                        
												clearInterval(enablePhysicalNetworkIntervalID); 
												
                        if (result.jobstatus == 1) {
                          //alert("updatePhysicalNetwork succeeded.");

                          // get network service provider ID of Virtual Router
                          var virtualRouterProviderId;
                          $.ajax({
                            url: createURL("listNetworkServiceProviders&name=VirtualRouter&physicalNetworkId=" + args.data.returnedBasicPhysicalNetwork.id),
                            dataType: "json",
                            async: false,
                            success: function(json) {
                              var items = json.listnetworkserviceprovidersresponse.networkserviceprovider;
                              if(items != null && items.length > 0) {
                                virtualRouterProviderId = items[0].id;
                              }
                            }
                          });
                          if(virtualRouterProviderId == null) {
                            alert("error: listNetworkServiceProviders API doesn't return VirtualRouter provider ID");
                            return;
                          }

                          var virtualRouterElementId;
                          $.ajax({
                            url: createURL("listVirtualRouterElements&nspid=" + virtualRouterProviderId),
                            dataType: "json",
                            async: false,
                            success: function(json) {
                              var items = json.listvirtualrouterelementsresponse.virtualrouterelement;
                              if(items != null && items.length > 0) {
                                virtualRouterElementId = items[0].id;
                              }
                            }
                          });
                          if(virtualRouterElementId == null) {
                            alert("error: listVirtualRouterElements API doesn't return Virtual Router Element Id");
                            return;
                          }

                          $.ajax({
                            url: createURL("configureVirtualRouterElement&enabled=true&id=" + virtualRouterElementId),
                            dataType: "json",
                            async: false,
                            success: function(json) {  
															var enableVirtualRouterElementIntervalID = setInterval(function() { 	
                                $.ajax({
                                  url: createURL("queryAsyncJobResult&jobId=" + json.configurevirtualrouterelementresponse.jobid),
                                  dataType: "json",
                                  success: function(json) {
                                    var result = json.queryasyncjobresultresponse;
                                    if (result.jobstatus == 0) {
                                      return; //Job has not completed
                                    }
                                    else {                                     
																			clearInterval(enableVirtualRouterElementIntervalID); 
																			
                                      if (result.jobstatus == 1) {
                                        //alert("configureVirtualRouterElement succeeded.");

                                        $.ajax({
                                          url: createURL("updateNetworkServiceProvider&state=Enabled&id=" + virtualRouterProviderId),
                                          dataType: "json",
                                          async: false,
                                          success: function(json) {    
																						var enableVirtualRouterProviderIntervalID = setInterval(function() { 	
                                              $.ajax({
                                                url: createURL("queryAsyncJobResult&jobId=" + json.updatenetworkserviceproviderresponse.jobid),
                                                dataType: "json",
                                                success: function(json) {
                                                  var result = json.queryasyncjobresultresponse;
                                                  if (result.jobstatus == 0) {
                                                    return; //Job has not completed
                                                  }
                                                  else {                                                    
																										clearInterval(enableVirtualRouterProviderIntervalID); 
																										
                                                    if (result.jobstatus == 1) {
                                                      //alert("Virtual Router Provider is enabled");
																											
																											if(args.data.pluginFrom != null && args.data.pluginFrom.name == "installWizard") {
																											  selectedNetworkOfferingHavingSG = args.data.pluginFrom.selectedNetworkOfferingHavingSG;
																											}
                                                      if(selectedNetworkOfferingHavingSG == true) { //need to Enable security group provider first																											  
																												message(dictionary['message.enabling.security.group.provider']); 
																											
                                                        // get network service provider ID of Security Group
                                                        var securityGroupProviderId;
                                                        $.ajax({
                                                          url: createURL("listNetworkServiceProviders&name=SecurityGroupProvider&physicalNetworkId=" + args.data.returnedBasicPhysicalNetwork.id),
                                                          dataType: "json",
                                                          async: false,
                                                          success: function(json) {
                                                            var items = json.listnetworkserviceprovidersresponse.networkserviceprovider;
                                                            if(items != null && items.length > 0) {
                                                              securityGroupProviderId = items[0].id;
                                                            }
                                                          }
                                                        });
                                                        if(securityGroupProviderId == null) {
                                                          alert("error: listNetworkServiceProviders API doesn't return security group provider ID");
                                                          return;
                                                        }

                                                        $.ajax({
                                                          url: createURL("updateNetworkServiceProvider&state=Enabled&id=" + securityGroupProviderId),
                                                          dataType: "json",
                                                          async: false,
                                                          success: function(json) {                                                            
																														var enableSecurityGroupProviderIntervalID = setInterval(function() { 	
                                                              $.ajax({
                                                                url: createURL("queryAsyncJobResult&jobId=" + json.updatenetworkserviceproviderresponse.jobid),
                                                                dataType: "json",
                                                                success: function(json) {
                                                                  var result = json.queryasyncjobresultresponse;
                                                                  if (result.jobstatus == 0) {
                                                                    return; //Job has not completed
                                                                  }
                                                                  else {                                                                   
																																		clearInterval(enableSecurityGroupProviderIntervalID); 
																																		
                                                                    if (result.jobstatus == 1) { //Security group provider has been enabled successfully      
																																			stepFns.addNetscalerProvider({
																																				data: args.data
																																			});																																			
                                                                    }
                                                                    else if (result.jobstatus == 2) {
                                                                      alert("failed to enable security group provider. Error: " + _s(result.jobresult.errortext));
                                                                    }
                                                                  }
                                                                },
                                                                error: function(XMLHttpResponse) {
                                                                  var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                                                  alert("failed to enable security group provider. Error: " + errorMsg);
                                                                }
                                                              });                                                            
																														}, 3000); 	
                                                          }
                                                        });
                                                      }
                                                      else { //selectedNetworkOfferingHavingSG == false                                                        																											
                                                        stepFns.addNetscalerProvider({
																													data: args.data
																												});                                                       																									
                                                      }
                                                    }
                                                    else if (result.jobstatus == 2) {
                                                      alert("failed to enable Virtual Router Provider. Error: " + _s(result.jobresult.errortext));
                                                    }
                                                  }
                                                },
                                                error: function(XMLHttpResponse) {
                                                  var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                                  alert("failed to enable Virtual Router Provider. Error: " + errorMsg);
                                                }
                                              });                                            
																						}, 3000); 	
                                          }
                                        });
                                      }
                                      else if (result.jobstatus == 2) {
                                        alert("configureVirtualRouterElement failed. Error: " + _s(result.jobresult.errortext));
                                      }
                                    }
                                  },
                                  error: function(XMLHttpResponse) {
                                    var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                    alert("configureVirtualRouterElement failed. Error: " + errorMsg);
                                  }
                                });                              
															}, 3000); 	
                            }
                          });
                        }
                        else if (result.jobstatus == 2) {
                          alert("updatePhysicalNetwork failed. Error: " + _s(result.jobresult.errortext));
                        }
                      }
                    },
                    error: function(XMLHttpResponse) {
                      var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                      alert("updatePhysicalNetwork failed. Error: " + errorMsg);
                    }
                  });                
								}, 3000); 	
              }
            });
          }
          else if(args.data.zone.networkType == "Advanced") {
            $(args.data.returnedPhysicalNetworks).each(function(){
              var thisPhysicalNetwork = this;
              $.ajax({
                url: createURL("updatePhysicalNetwork&state=Enabled&id=" + thisPhysicalNetwork.id),
                dataType: "json",
                success: function(json) {
                  var jobId = json.updatephysicalnetworkresponse.jobid;                  						
									var enablePhysicalNetworkIntervalID = setInterval(function() { 									  
                    $.ajax({
                      url: createURL("queryAsyncJobResult&jobId="+jobId),
                      dataType: "json",
                      success: function(json) {
                        var result = json.queryasyncjobresultresponse;
                        if (result.jobstatus == 0) {
                          return; //Job has not completed
                        }
                        else {		
													clearInterval(enablePhysicalNetworkIntervalID); 
													
                          if (result.jobstatus == 1) {
                            //alert("updatePhysicalNetwork succeeded.");

                            // ***** Virtual Router ***** (begin) *****
                            var virtualRouterProviderId;
                            $.ajax({
                              url: createURL("listNetworkServiceProviders&name=VirtualRouter&physicalNetworkId=" + thisPhysicalNetwork.id),
                              dataType: "json",
                              async: false,
                              success: function(json) {
                                var items = json.listnetworkserviceprovidersresponse.networkserviceprovider;
                                if(items != null && items.length > 0) {
                                  virtualRouterProviderId = items[0].id;
                                }
                              }
                            });
                            if(virtualRouterProviderId == null) {
                              alert("error: listNetworkServiceProviders API doesn't return VirtualRouter provider ID");
                              return;
                            }

                            var virtualRouterElementId;
                            $.ajax({
                              url: createURL("listVirtualRouterElements&nspid=" + virtualRouterProviderId),
                              dataType: "json",
                              async: false,
                              success: function(json) {
                                var items = json.listvirtualrouterelementsresponse.virtualrouterelement;
                                if(items != null && items.length > 0) {
                                  virtualRouterElementId = items[0].id;
                                }
                              }
                            });
                            if(virtualRouterElementId == null) {
                              alert("error: listVirtualRouterElements API doesn't return Virtual Router Element Id");
                              return;
                            }

                            $.ajax({
                              url: createURL("configureVirtualRouterElement&enabled=true&id=" + virtualRouterElementId),
                              dataType: "json",
                              async: false,
                              success: function(json) {
                                var jobId = json.configurevirtualrouterelementresponse.jobid;                                
																var enableVirtualRouterElementIntervalID = setInterval(function() { 	
                                  $.ajax({
                                    url: createURL("queryAsyncJobResult&jobId="+jobId),
                                    dataType: "json",
                                    success: function(json) {
                                      var result = json.queryasyncjobresultresponse;
                                      if (result.jobstatus == 0) {
                                        return; //Job has not completed
                                      }
                                      else {                                        
																				clearInterval(enableVirtualRouterElementIntervalID); 
																				
                                        if (result.jobstatus == 1) { //configureVirtualRouterElement succeeded
                                          $.ajax({
                                            url: createURL("updateNetworkServiceProvider&state=Enabled&id=" + virtualRouterProviderId),
                                            dataType: "json",
                                            async: false,
                                            success: function(json) {
                                              var jobId = json.updatenetworkserviceproviderresponse.jobid;                                             
																							var enableVirtualRouterProviderIntervalID = setInterval(function() { 	
                                                $.ajax({
                                                  url: createURL("queryAsyncJobResult&jobId="+jobId),
                                                  dataType: "json",
                                                  success: function(json) {
                                                    var result = json.queryasyncjobresultresponse;
                                                    if (result.jobstatus == 0) {
                                                      return; //Job has not completed
                                                    }
                                                    else {                                                      
																											clearInterval(enableVirtualRouterProviderIntervalID); 
																											
                                                      if (result.jobstatus == 1) { //Virtual Router Provider has been enabled successfully
                                                        advZoneConfiguredVirtualRouterCount++;
                                                        if(advZoneConfiguredVirtualRouterCount == (args.data.returnedPhysicalNetworks.length * 2)) { //not call addPod() until virtualRouter and vpcVirtualRouter of all physical networks get configured
                                                          stepFns.addPod({
                                                            data: args.data
                                                          });
                                                        }
                                                      }
                                                      else if (result.jobstatus == 2) {
                                                        alert("failed to enable Virtual Router Provider. Error: " + _s(result.jobresult.errortext));
                                                      }
                                                    }
                                                  },
                                                  error: function(XMLHttpResponse) {
                                                    var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                                    alert("updateNetworkServiceProvider failed. Error: " + errorMsg);
                                                  }
                                                });                                              
																							}, 3000); 	
                                            }
                                          });
                                        }
                                        else if (result.jobstatus == 2) {
                                          alert("configureVirtualRouterElement failed. Error: " + _s(result.jobresult.errortext));
                                        }
                                      }
                                    },
                                    error: function(XMLHttpResponse) {
                                      var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                      alert("configureVirtualRouterElement failed. Error: " + errorMsg);
                                    }
                                  });                                
																}, 3000); 	
                              }
                            });
														// ***** Virtual Router ***** (end) *****
														
														// ***** VPC Virtual Router ***** (begin) *****
                            var vpcVirtualRouterProviderId;
                            $.ajax({
                              url: createURL("listNetworkServiceProviders&name=VpcVirtualRouter&physicalNetworkId=" + thisPhysicalNetwork.id),
                              dataType: "json",
                              async: false,
                              success: function(json) {
                                var items = json.listnetworkserviceprovidersresponse.networkserviceprovider;
                                if(items != null && items.length > 0) {
                                  vpcVirtualRouterProviderId = items[0].id;
                                }
                              }
                            });
                            if(vpcVirtualRouterProviderId == null) {
                              alert("error: listNetworkServiceProviders API doesn't return VpcVirtualRouter provider ID");
                              return;
                            }

                            var vpcVirtualRouterElementId;
                            $.ajax({
                              url: createURL("listVirtualRouterElements&nspid=" + vpcVirtualRouterProviderId),
                              dataType: "json",
                              async: false,
                              success: function(json) {
                                var items = json.listvirtualrouterelementsresponse.virtualrouterelement;
                                if(items != null && items.length > 0) {
                                  vpcVirtualRouterElementId = items[0].id;
                                }
                              }
                            });
                            if(vpcVirtualRouterElementId == null) {
                              alert("error: listVirtualRouterElements API doesn't return VPC Virtual Router Element Id");
                              return;
                            }

                            $.ajax({
                              url: createURL("configureVirtualRouterElement&enabled=true&id=" + vpcVirtualRouterElementId),
                              dataType: "json",
                              async: false,
                              success: function(json) {
                                var jobId = json.configurevirtualrouterelementresponse.jobid;                                
																var enableVpcVirtualRouterElementIntervalID = setInterval(function() { 	
                                  $.ajax({
                                    url: createURL("queryAsyncJobResult&jobId="+jobId),
                                    dataType: "json",
                                    success: function(json) {
                                      var result = json.queryasyncjobresultresponse;
                                      if (result.jobstatus == 0) {
                                        return; //Job has not completed
                                      }
                                      else {                                        
																				clearInterval(enableVpcVirtualRouterElementIntervalID); 
																				
                                        if (result.jobstatus == 1) { //configureVirtualRouterElement succeeded
                                          $.ajax({
                                            url: createURL("updateNetworkServiceProvider&state=Enabled&id=" + vpcVirtualRouterProviderId),
                                            dataType: "json",
                                            async: false,
                                            success: function(json) {
                                              var jobId = json.updatenetworkserviceproviderresponse.jobid;                                             
																							var enableVpcVirtualRouterProviderIntervalID = setInterval(function() { 	
                                                $.ajax({
                                                  url: createURL("queryAsyncJobResult&jobId="+jobId),
                                                  dataType: "json",
                                                  success: function(json) {
                                                    var result = json.queryasyncjobresultresponse;
                                                    if (result.jobstatus == 0) {
                                                      return; //Job has not completed
                                                    }
                                                    else {                                                      
																											clearInterval(enableVpcVirtualRouterProviderIntervalID); 
																											
                                                      if (result.jobstatus == 1) { //Virtual Router Provider has been enabled successfully
                                                        advZoneConfiguredVirtualRouterCount++;
                                                        if(advZoneConfiguredVirtualRouterCount == (args.data.returnedPhysicalNetworks.length * 2)) { //not call addPod() until virtualRouter and vpcVirtualRouter of all physical networks get configured
                                                          stepFns.addPod({
                                                            data: args.data
                                                          });
                                                        }
                                                      }
                                                      else if (result.jobstatus == 2) {
                                                        alert("failed to enable VPC Virtual Router Provider. Error: " + _s(result.jobresult.errortext));
                                                      }
                                                    }
                                                  },
                                                  error: function(XMLHttpResponse) {
                                                    var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                                    alert("updateNetworkServiceProvider failed. Error: " + errorMsg);
                                                  }
                                                });                                              
																							}, 3000); 	
                                            }
                                          });
                                        }
                                        else if (result.jobstatus == 2) {
                                          alert("configureVirtualRouterElement failed. Error: " + _s(result.jobresult.errortext));
                                        }
                                      }
                                    },
                                    error: function(XMLHttpResponse) {
                                      var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                                      alert("configureVirtualRouterElement failed. Error: " + errorMsg);
                                    }
                                  });                                
																}, 3000); 	
                              }
                            });
														// ***** VPC Virtual Router ***** (end) *****
                          }
                          else if (result.jobstatus == 2) {
                            alert("updatePhysicalNetwork failed. Error: " + _s(result.jobresult.errortext));
                          }
                        }
                      },
                      error: function(XMLHttpResponse) {
                        var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                        alert("updatePhysicalNetwork failed. Error: " + errorMsg);
                      }
                    });                  
									}, 3000); 		
                }
              });
            });
          }
        },
				
				addNetscalerProvider: function(args) {   	
					if(selectedNetworkOfferingHavingNetscaler == true) {					  
					  message(dictionary['message.adding.Netscaler.provider']); 
						
						$.ajax({
							url: createURL("addNetworkServiceProvider&name=Netscaler&physicalnetworkid=" + args.data.returnedBasicPhysicalNetwork.id),
							dataType: "json",
							async: false,
							success: function(json) {								
								var addNetscalerProviderIntervalID = setInterval(function() { 	                  						
									$.ajax({
										url: createURL("queryAsyncJobResult&jobId=" + json.addnetworkserviceproviderresponse.jobid),
										dataType: "json",
										success: function(json) {
											var result = json.queryasyncjobresultresponse;
											if (result.jobstatus == 0) {
												return; //Job has not completed
											}
											else {												
												clearInterval(addNetscalerProviderIntervalID); 
												
												if (result.jobstatus == 1) {
													args.data.returnedNetscalerProvider = result.jobresult.networkserviceprovider;                       
													stepFns.addNetscalerDevice({
														data: args.data
													});
												}
												else if (result.jobstatus == 2) {
													alert("addNetworkServiceProvider&name=Netscaler failed. Error: " + _s(result.jobresult.errortext));
												}
											}
										},
										error: function(XMLHttpResponse) {
											var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
											alert("addNetworkServiceProvider&name=Netscaler failed. Error: " + errorMsg);
										}
									});							
								}, 3000); 
							}		
            });		
						//add netscaler provider (end)
					}
					else { //selectedNetworkOfferingHavingNetscaler == false
						//create a guest network for basic zone						
						stepFns.addGuestNetwork({
							data: args.data
						});							
					}		
        },
				
				
        addNetscalerDevice: function(args) {
          message(dictionary['message.adding.Netscaler.device']); 

          var array1 = [];
          array1.push("&physicalnetworkid=" + args.data.returnedBasicPhysicalNetwork.id);
          array1.push("&username=" + todb(args.data.basicPhysicalNetwork.username));
          array1.push("&password=" + todb(args.data.basicPhysicalNetwork.password));
          array1.push("&networkdevicetype=" + todb(args.data.basicPhysicalNetwork.networkdevicetype));

          //construct URL starts here
          var url = [];

          var ip = args.data.basicPhysicalNetwork.ip;
          url.push("https://" + ip);

          var isQuestionMarkAdded = false;

          var publicInterface = args.data.basicPhysicalNetwork.publicinterface;
          if(publicInterface != null && publicInterface.length > 0) {
              if(isQuestionMarkAdded == false) {
                  url.push("?");
                  isQuestionMarkAdded = true;
              }
              else {
                  url.push("&");
              }
              url.push("publicinterface=" + publicInterface);
          }

          var privateInterface = args.data.basicPhysicalNetwork.privateinterface;
          if(privateInterface != null && privateInterface.length > 0) {
              if(isQuestionMarkAdded == false) {
                  url.push("?");
                  isQuestionMarkAdded = true;
              }
              else {
                  url.push("&");
              }
              url.push("privateinterface=" + privateInterface);
          }

          var numretries = args.data.basicPhysicalNetwork.numretries;
          if(numretries != null && numretries.length > 0) {
              if(isQuestionMarkAdded == false) {
                  url.push("?");
                  isQuestionMarkAdded = true;
              }
              else {
                  url.push("&");
              }
              url.push("numretries=" + numretries);
          }

          var isInline = args.data.basicPhysicalNetwork.inline;
          if(isInline != null && isInline.length > 0) {
              if(isQuestionMarkAdded == false) {
                  url.push("?");
                  isQuestionMarkAdded = true;
              }
              else {
                  url.push("&");
              }
              url.push("inline=" + isInline);
          }

          var capacity = args.data.basicPhysicalNetwork.capacity;
          if(capacity != null && capacity.length > 0) {
              if(isQuestionMarkAdded == false) {
                  url.push("?");
                  isQuestionMarkAdded = true;
              }
              else {
                  url.push("&");
              }
              url.push("lbdevicecapacity=" + capacity);
          }

          var dedicated = (args.data.basicPhysicalNetwork.dedicated == "on");	//boolean	(true/false)
          if(isQuestionMarkAdded == false) {
              url.push("?");
              isQuestionMarkAdded = true;
          }
          else {
              url.push("&");
          }
          url.push("lbdevicededicated=" + dedicated.toString());


          array1.push("&url=" + todb(url.join("")));
          //construct URL ends here

          $.ajax({
            url: createURL("addNetscalerLoadBalancer" + array1.join("")),
            dataType: "json",
            success: function(json) {             
							var addNetscalerLoadBalancerIntervalID = setInterval(function() { 								
                $.ajax({
                  url: createURL("queryAsyncJobResult&jobid=" + json.addnetscalerloadbalancerresponse.jobid),
                  dataType: "json",
                  success: function(json) {
                    var result = json.queryasyncjobresultresponse;
                    if(result.jobstatus == 0) {
                      return;
                    }
                    else {                      
											clearInterval(addNetscalerLoadBalancerIntervalID); 
											
                      if(result.jobstatus == 1) {
                        args.data.returnedNetscalerProvider.returnedNetscalerloadbalancer = result.jobresult.netscalerloadbalancer;

                        $.ajax({
                          url: createURL("updateNetworkServiceProvider&state=Enabled&id=" + args.data.returnedNetscalerProvider.id),
                          dataType: "json",
                          success: function(json) {                            
														var enableNetscalerProviderIntervalID = setInterval(function() { 	
                              $.ajax({
                                url: createURL("queryAsyncJobResult&jobid=" + json.updatenetworkserviceproviderresponse.jobid),
                                dataType: "json",
                                success: function(json) {
                                  var result = json.queryasyncjobresultresponse;
                                  if(result.jobstatus == 0) {
                                    return;
                                  }
                                  else {                                    
																		clearInterval(enableNetscalerProviderIntervalID); 
																		
                                    if(result.jobstatus == 1) {																		 
																			stepFns.addGuestNetwork({
																				data: args.data
																			});		
                                    }
                                    else if(result.jobstatus == 2) {
                                      alert("failed to enable Netscaler provider. Error: " + _s(result.jobresult.errortext));
                                    }
                                  }
                                }
                              });                            
														}, 3000); 															
                          },
                          error: function(XMLHttpResponse) {
                            var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                            alert("failed to enable Netscaler provider. Error: " + errorMsg);
                          }
                        });
                      }
                      else if(result.jobstatus == 2) {  //addNetscalerLoadBalancer failed
                        error('addNetscalerDevice', _s(result.jobresult.errortext), { fn: 'addNetscalerDevice', args: args });
                      }
                    }
                  }
                });              
							}, 3000); 								
            },
            error: function(XMLHttpResponse) {
              var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
              error('addNetscalerDevice', errorMsg, { fn: 'addNetscalerDevice', args: args });
            }
          });
        },
				
				addGuestNetwork: function(args) {  //create a guest network for basic zone
          message(dictionary['message.creating.guest.network']); 
          
					var array2 = [];
					array2.push("&zoneid=" + args.data.returnedZone.id);
					array2.push("&name=guestNetworkForBasicZone");
					array2.push("&displaytext=guestNetworkForBasicZone");
					array2.push("&networkofferingid=" + args.data.zone.networkOfferingId);
					$.ajax({
						url: createURL("createNetwork" + array2.join("")),
						dataType: "json",
						async: false,
						success: function(json) {
							//basic zone has only one physical network => addPod() will be called only once => so don't need to double-check before calling addPod()
							stepFns.addPod({
								data: $.extend(args.data, {
									returnedGuestNetwork: json.createnetworkresponse.network
								})
							});
						},
						error: function(XMLHttpResponse) {
							var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
							alert("failed to create a guest network for basic zone. Error: " + errorMsg);
						}
					});																			
				},
								
        addPod: function(args) {
          message(dictionary['message.creating.pod']); 

          var array3 = [];
          array3.push("&zoneId=" + args.data.returnedZone.id);
          array3.push("&name=" + todb(args.data.pod.name));
          array3.push("&gateway=" + todb(args.data.pod.reservedSystemGateway));
          array3.push("&netmask=" + todb(args.data.pod.reservedSystemNetmask));
          array3.push("&startIp=" + todb(args.data.pod.reservedSystemStartIp));

          var endip = args.data.pod.reservedSystemEndIp;      //optional
          if (endip != null && endip.length > 0)
            array3.push("&endIp=" + todb(endip));

          $.ajax({
            url: createURL("createPod" + array3.join("")),
            dataType: "json",
            async: false,
            success: function(json) {
              stepFns.configurePublicTraffic({
                data: $.extend(args.data, {
                  returnedPod: json.createpodresponse.pod
                })
              });
            },
            error: function(XMLHttpResponse) {
              var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
              error('addPod', errorMsg, { fn: 'addPod', args: args });
            }
          });
        },

        configurePublicTraffic: function(args) {
          if((args.data.zone.networkType == "Basic" && (selectedNetworkOfferingHavingSG == true && selectedNetworkOfferingHavingEIP == true && selectedNetworkOfferingHavingELB == true))
           ||(args.data.zone.networkType == "Advanced")) {
					 
            message(dictionary['message.configuring.public.traffic']); 

            var stopNow = false;

            $(args.data.publicTraffic).each(function(){
              var thisPublicVlanIpRange = this;

              //check whether the VlanIpRange exists or not (begin)
              var isExisting = false;
              $(returnedPublicVlanIpRanges).each(function() {
                if(this.vlan == thisPublicVlanIpRange.vlanid && this.startip == thisPublicVlanIpRange.startip && this.netmask == thisPublicVlanIpRange.netmask && this.gateway == thisPublicVlanIpRange.gateway) {
                  isExisting = true;
                  return false; //break each loop
                }
              });
              if(isExisting == true)
                return; //skip current item to next item (continue each loop)

              //check whether the VlanIpRange exists or not (end)

              var array1 = [];
              array1.push("&zoneId=" + args.data.returnedZone.id);

              if (this.vlanid != null && this.vlanid.length > 0)
                array1.push("&vlan=" + todb(this.vlanid));
              else
                array1.push("&vlan=untagged");

              array1.push("&gateway=" + this.gateway);
              array1.push("&netmask=" + this.netmask);
              array1.push("&startip=" + this.startip);
              if(this.endip != null && this.endip.length > 0)
                array1.push("&endip=" + this.endip);

              array1.push("&forVirtualNetwork=true");

              $.ajax({
                url: createURL("createVlanIpRange" + array1.join("")),
                dataType: "json",
                async: false,
                success: function(json) {
                  var item = json.createvlaniprangeresponse.vlan;
                  returnedPublicVlanIpRanges.push(item);
                },
                error: function(XMLHttpResponse) {
                  var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                  error('configurePublicTraffic', errorMsg, { fn: 'configurePublicTraffic', args: args });
                  stopNow = true;
                }
              });

              if(stopNow == true)
                return false; //break each loop, don't create next VlanIpRange
            });

            if(stopNow == true)
              return; //stop the whole process

            stepFns.configureStorageTraffic({
              data: $.extend(args.data, {
                returnedPublicTraffic: returnedPublicVlanIpRanges
              })
            });
          }
          else { //basic zone without public traffic type , skip to next step
            if (data.physicalNetworks && $.inArray('storage', data.physicalNetworks[0].trafficTypes) > -1) {
              stepFns.configureStorageTraffic({
                data: args.data
              });
            } else {
              stepFns.configureGuestTraffic({
                data: args.data
              });
            }
          }
        },

        configureStorageTraffic: function(args) {
          var complete = function(data) {
            stepFns.configureGuestTraffic({
              data: $.extend(args.data, data)
            });
          };

          var targetNetwork = $.grep(args.data.physicalNetworks, function(net) {
            return $.inArray('storage', net.trafficTypes) > -1; });

          if (!targetNetwork.length) {
            return complete({});
          }

          message(dictionary['message.configuring.storage.traffic']);  
          
          var storageIPRanges = args.data.storageTraffic;
          var tasks = [];
          var taskTimer;

          $(storageIPRanges).each(function() {
            var item = this;
              if('vlan' in item && (item.vlan == null || item.vlan.length == 0))
                delete item.vlan;
            $.ajax({
              url: createURL('createStorageNetworkIpRange'),
              data: $.extend(true, {}, item, {
                zoneid: args.data.returnedZone.id,
                podid: args.data.returnedPod.id
              }),
              success: function(json) {
                tasks.push({
                  jobid: json.createstoragenetworkiprangeresponse.jobid,
                  complete: false
                });
              },
              error: function(json) {
                tasks.push({
                  error: true,
                  message: parseXMLHttpResponse(json)
                });
              }
            });
          });

          taskTimer = setInterval(function() {
            var completedTasks = $.grep(tasks, function(task) {
              return task.complete || task.error;
            });

            var errorTasks = $.grep(tasks, function(task) {
              return task.error;
            });

            if (completedTasks.length == storageIPRanges.length) {
              clearInterval(taskTimer);

              if (errorTasks.length) {
                return error('configureStorageTraffic', errorTasks[0].message, {
                  fn: 'configureStorageTraffic', args: args
                });
              }
              
              return complete({});
            }
            
            if (tasks.length == storageIPRanges.length) {
              $(tasks).each(function() {
                var task = this;

                if (task.error) return true;

                pollAsyncJobResult({
                  _custom: { jobId: task.jobid },
                  complete: function() {
                    task.complete = true;
                  },
                  error: function(args) {
                    task.error = true;
                    task.message = args.message;
                  }
                });

                return true;
              });
            }
            
            return true;
          }, 1000);

          return true;
        },

        configureGuestTraffic: function(args) {		
					if(skipGuestTrafficStep == true) {
					  stepFns.addCluster({
							data: args.data
						});		
            return;			
					}					
									
          message(dictionary['message.configuring.guest.traffic']);  

          if(args.data.returnedZone.networktype == "Basic") {		//create an VlanIpRange for guest network in basic zone
            var array1 = [];
            array1.push("&podid=" + args.data.returnedPod.id);
            array1.push("&networkid=" + args.data.returnedGuestNetwork.id);
            array1.push("&gateway=" + args.data.guestTraffic.guestGateway);
            array1.push("&netmask=" + args.data.guestTraffic.guestNetmask);
            array1.push("&startip=" + args.data.guestTraffic.guestStartIp);
            if(args.data.guestTraffic.guestEndIp != null && args.data.guestTraffic.guestEndIp.length > 0)
              array1.push("&endip=" + args.data.guestTraffic.guestEndIp);
            array1.push("&forVirtualNetwork=false"); //indicates this new IP range is for guest network, not public network

            $.ajax({
              url: createURL("createVlanIpRange" + array1.join("")),
              dataType: "json",
              success: function(json) {
                args.data.returnedGuestNetwork.returnedVlanIpRange = json.createvlaniprangeresponse.vlan;
                stepFns.addCluster({
                  data: args.data
                });
              },
              error: function(XMLHttpResponse) {
                var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                error('configureGuestTraffic', errorMsg, { fn: 'configureGuestTraffic', args: args });
              }
            });
          }
          else if(args.data.returnedZone.networktype == "Advanced") {  //update VLAN in physical network(s) in advanced zone
            var physicalNetworksHavingGuestIncludingVlan = [];
            $(args.data.physicalNetworks).each(function(){
              if(this.guestConfiguration != null && this.guestConfiguration.vlanRangeStart != null && this.guestConfiguration.vlanRangeStart.length > 0) {
                physicalNetworksHavingGuestIncludingVlan.push(this);
              }
            });

            if(physicalNetworksHavingGuestIncludingVlan.length == 0) {
              stepFns.addCluster({
                data: args.data
              });
            }
            else {
              var updatedCount = 0;
              $(physicalNetworksHavingGuestIncludingVlan).each(function(){
                var vlan;
                if(this.guestConfiguration.vlanRangeEnd == null || this.guestConfiguration.vlanRangeEnd.length == 0)
                  vlan = this.guestConfiguration.vlanRangeStart;
                else
                  vlan = this.guestConfiguration.vlanRangeStart + "-" + this.guestConfiguration.vlanRangeEnd;

                var originalId = this.id;
                var returnedId;
                $(args.data.returnedPhysicalNetworks).each(function(){
                  if(this.originalId == originalId) {
                    returnedId = this.id;
                    return false; //break the loop
                  }
                });

                $.ajax({
                  url: createURL("updatePhysicalNetwork&id=" + returnedId  + "&vlan=" + todb(vlan)),
                  dataType: "json",
                  success: function(json) {
                    var jobId = json.updatephysicalnetworkresponse.jobid;                    
										var updatePhysicalNetworkVlanIntervalID = setInterval(function() { 											
                      $.ajax({
                        url: createURL("queryAsyncJobResult&jobid=" + jobId),
                        dataType: "json",
                        success: function(json) {
                          var result = json.queryasyncjobresultresponse;
                          if(result.jobstatus == 0) {
                            return;
                          }
                          else {                            
														clearInterval(updatePhysicalNetworkVlanIntervalID); 
														
                            if(result.jobstatus == 1) {
                              updatedCount++;
                              if(updatedCount == physicalNetworksHavingGuestIncludingVlan.length) {
                                stepFns.addCluster({
                                  data: args.data
                                });
                              }
                            }
                            else if(result.jobstatus == 2){
                              alert("error: " + _s(result.jobresult.errortext));
                            }
                          }
                        },
                        error: function(XMLHttpResponse) {
                          var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
                          error('configureGuestTraffic', errorMsg, { fn: 'configureGuestTraffic', args: args });
                        }
                      });                    
										}, 3000); 	
                  }
                });
              });
            }
          }
        },

        addCluster: function(args) {
          message(dictionary['message.creating.cluster']);
					
          // Have cluster use zone's hypervisor
          args.data.cluster.hypervisor = args.data.zone.hypervisor ?
            args.data.zone.hypervisor : args.data.cluster.hypervisor;

          var array1 = [];
          array1.push("&zoneId=" + args.data.returnedZone.id);
          array1.push("&hypervisor=" + args.data.cluster.hypervisor);

          var clusterType;
          if(args.data.cluster.hypervisor == "VMware")
            clusterType="ExternalManaged";
          else
            clusterType="CloudManaged";
          array1.push("&clustertype=" + clusterType);

          array1.push("&podId=" + args.data.returnedPod.id);

          var clusterName = args.data.cluster.name;

          if(args.data.cluster.hypervisor == "VMware") {
            array1.push("&username=" + todb(args.data.cluster.vCenterUsername));
            array1.push("&password=" + todb(args.data.cluster.vCenterPassword));

            if (args.data.cluster.vsmipaddress) { // vSwitch is enabled
              array1.push('&vsmipaddress=' + args.data.cluster.vsmipaddress);
              array1.push('&vsmusername=' + args.data.cluster.vsmusername);
              array1.push('&vsmpassword=' + args.data.cluster.vsmpassword);
            }

            var hostname = args.data.cluster.vCenterHost;
            var dcName = args.data.cluster.vCenterDatacenter;

            var url;
            if(hostname.indexOf("http://") == -1)
              url = "http://" + hostname;
            else
              url = hostname;
            url += "/" + dcName + "/" + clusterName;
            array1.push("&url=" + todb(url));

            clusterName = hostname + "/" + dcName + "/" + clusterName; //override clusterName
          }
          array1.push("&clustername=" + todb(clusterName));

          $.ajax({
            url: createURL("addCluster" + array1.join("")),
            dataType: "json",
            async: true,
            success: function(json) {
              if(args.data.cluster.hypervisor != "VMware") {
                stepFns.addHost({
                  data: $.extend(args.data, {
                    returnedCluster: json.addclusterresponse.cluster[0]
                  })
                });
              }
              else { 
                stepFns.addPrimaryStorage({
                  data: $.extend(args.data, {
                    returnedCluster: json.addclusterresponse.cluster[0]
                  })
                });
              }
            },
            error: function(XMLHttpResponse) {
              var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
              error('addCluster', errorMsg, { fn: 'addCluster', args: args });
            }
          });
        },

        addHost: function(args) {
          message(dictionary['message.adding.host']); 

          var array1 = [];
          array1.push("&zoneid=" + args.data.returnedZone.id);
          array1.push("&podid=" + args.data.returnedPod.id);
          array1.push("&clusterid=" + args.data.returnedCluster.id);
          array1.push("&hypervisor=" + todb(args.data.returnedCluster.hypervisortype));
          var clustertype = args.data.returnedCluster.clustertype;
          array1.push("&clustertype=" + todb(clustertype));
          array1.push("&hosttags=" + todb(args.data.host.hosttags));    
					array1.push("&username=" + todb(args.data.host.username));
					array1.push("&password=" + todb(args.data.host.password));

					var hostname = args.data.host.hostname;

					var url;
					if(hostname.indexOf("http://")==-1)
						url = "http://" + hostname;
					else
						url = hostname;
					array1.push("&url="+todb(url));

					if (args.data.cluster.hypervisor == "BareMetal") {
						array1.push("&cpunumber=" + todb(args.data.host.baremetalCpuCores));
						array1.push("&cpuspeed=" + todb(args.data.host.baremetalCpu));
						array1.push("&memory=" + todb(args.data.host.baremetalMemory));
						array1.push("&hostmac=" + todb(args.data.host.baremetalMAC));
					}
					else if(args.data.cluster.hypervisor == "Ovm") {
						array1.push("&agentusername=" + todb(args.data.host.agentUsername));
						array1.push("&agentpassword=" + todb(args.data.host.agentPassword));
					}
          

          $.ajax({
            url: createURL("addHost" + array1.join("")),
            dataType: "json",
            success: function(json) {
              stepFns.addPrimaryStorage({
                data: $.extend(args.data, {
                  returnedHost: json.addhostresponse.host[0]
                })
              });
            },
            error: function(XMLHttpResponse) {
              var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
              error('addHost', errorMsg, { fn: 'addHost', args: args });
            }
          });
        },

        addPrimaryStorage: function(args) {
					if(args.data.zone.localstorageenabled == 'on') { //use local storage, don't need primary storage. So, skip this step.
            stepFns.addSecondaryStorage({
              data: args.data
            });
            return;
          }

          message(dictionary['message.creating.primary.storage']);

          var array1 = [];
          array1.push("&zoneid=" + args.data.returnedZone.id);
          array1.push("&podId=" + args.data.returnedPod.id);
          array1.push("&clusterid=" + args.data.returnedCluster.id);
          array1.push("&name=" + todb(args.data.primaryStorage.name));

					var server = args.data.primaryStorage.server;
          var url = null;
          if (args.data.primaryStorage.protocol == "nfs") {
            //var path = trim($thisDialog.find("#add_pool_path").val());
            var path = args.data.primaryStorage.path;

            if(path.substring(0,1) != "/")
              path = "/" + path;
            url = nfsURL(server, path);
          }
          else if (args.data.primaryStorage.protocol == "PreSetup") {
            //var path = trim($thisDialog.find("#add_pool_path").val());
            var path = args.data.primaryStorage.path;

            if(path.substring(0,1) != "/")
              path = "/" + path;
            url = presetupURL(server, path);
          }
          else if (args.data.primaryStorage.protocol == "ocfs2") {
            //var path = trim($thisDialog.find("#add_pool_path").val());
            var path = args.data.primaryStorage.path;

            if(path.substring(0,1) != "/")
              path = "/" + path;
            url = ocfs2URL(server, path);
          }
          else if (args.data.primaryStorage.protocol == "SharedMountPoint") {
            //var path = trim($thisDialog.find("#add_pool_path").val());
            var path = args.data.primaryStorage.path;

            if(path.substring(0,1) != "/")
              path = "/" + path;
            url = SharedMountPointURL(server, path);
          }
          else if (args.data.primaryStorage.protocol == "clvm") {
            //var vg = trim($thisDialog.find("#add_pool_clvm_vg").val());
            var vg = args.data.primaryStorage.volumegroup;

            if(vg.substring(0,1) != "/")
              vg = "/" + vg;
            url = clvmURL(vg);
          }
          else if (args.data.primaryStorage.protocol == "vmfs") {
            //var path = trim($thisDialog.find("#add_pool_vmfs_dc").val());
            var path = args.data.primaryStorage.vCenterDataCenter;

            if(path.substring(0,1) != "/")
              path = "/" + path;
            path += "/" + args.data.primaryStorage.vCenterDataStore;
            url = vmfsURL("dummy", path);
          }
          else {
            //var iqn = trim($thisDialog.find("#add_pool_iqn").val());
            var iqn = args.data.primaryStorage.iqn;

            if(iqn.substring(0,1) != "/")
              iqn = "/" + iqn;
            var lun = args.data.primaryStorage.lun;
            url = iscsiURL(server, iqn, lun);
          }
          array1.push("&url=" + todb(url));

          if(args.data.primaryStorage.storageTags != null && args.data.primaryStorage.storageTags.length > 0)
            array1.push("&tags=" + todb(args.data.primaryStorage.storageTags));

          $.ajax({
            url: createURL("createStoragePool" + array1.join("")),
            dataType: "json",
            success: function(json) {
              stepFns.addSecondaryStorage({
                data: $.extend(args.data, {
                  returnedPrimaryStorage: json.createstoragepoolresponse.storagepool
                })
              });
            },
            error: function(XMLHttpResponse) {
              var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
              error('addPrimaryStorage', errorMsg, { fn: 'addPrimaryStorage', args: args });
            }
          });
        },

        addSecondaryStorage: function(args) {
          message(dictionary['message.creating.secondary.storage']);

          var nfs_server = args.data.secondaryStorage.nfsServer;
          var path = args.data.secondaryStorage.path;
          var url = nfsURL(nfs_server, path);

          $.ajax({
            url: createURL("addSecondaryStorage&zoneId=" + args.data.returnedZone.id + "&url=" + todb(url)),
            dataType: "json",
            success: function(json) {
              complete({
                data: $.extend(args.data, {
                  returnedSecondaryStorage: json.addsecondarystorageresponse.secondarystorage
                })
              });
            },
            error: function(XMLHttpResponse) {
              var errorMsg = parseXMLHttpResponse(XMLHttpResponse);
              error('addSecondaryStorage', errorMsg, { fn: 'addSecondaryStorage', args: args });
            }
          });
        }
      };

      var complete = function(args) {
        message(dictionary['message.Zone.creation.complete']);
        success(args);
      };

      if (startFn) {
        stepFns[startFn.fn]({
          data: $.extend(startFn.args.data, data)
        });
      } else {
        stepFns.addZone({});
      }
    },

    enableZoneAction: function(args) {
      $.ajax({
        url: createURL("updateZone&allocationstate=Enabled&id=" + args.launchData.returnedZone.id),
        dataType: "json",
        success: function(json) {
          args.formData.returnedZone = json.updatezoneresponse.zone;
          args.response.success();
        }
      });
    }
  };
}(cloudStack, jQuery));
